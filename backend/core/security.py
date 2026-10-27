import hashlib, hmac, ipaddress, json, secrets, socket, time
from urllib.parse import urlparse
from cryptography.fernet import Fernet
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import (
    AuthenticationFailed,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from .models import APIKey, OrganizationMembership, Project, AuditLog, UsageRecord

SCOPES = {
    "messages:send",
    "messages:read",
    "connections:read",
    "otp:send",
    "otp:verify",
    "workflows:manage",
    "webhooks:manage",
}


def client_ip(request):
    import os

    # X-Real-IP is trusted only when the operator enables the private Nginx boundary.
    return (
        request.META.get("HTTP_X_REAL_IP", request.META.get("REMOTE_ADDR", ""))
        if os.getenv("TRUST_PROXY", "0") == "1"
        else request.META.get("REMOTE_ADDR", "")
    )


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def encrypt(value):
    key = settings.CREDENTIAL_KEY
    if not key and settings.TESTING:
        key = b"c3RyaWN0bHktdGVzdC1rZXktMzItYnl0ZXMtbG9uZyE="
    return Fernet(key).encrypt(json.dumps(value).encode()).decode()


def decrypt(value):
    key = settings.CREDENTIAL_KEY
    if not key and settings.TESTING:
        key = b"c3RyaWN0bHktdGVzdC1rZXktMzItYnl0ZXMtbG9uZyE="
    return json.loads(Fernet(key).decrypt(value.encode()))


def rate_limit(key, limit, seconds):
    key = "rate:" + digest(key)
    if cache.add(key, 1, seconds):
        return
    try:
        count = cache.incr(key)
    except ValueError:
        cache.add(key, 1, seconds)
        return
    if count > limit:
        raise Throttled(wait=seconds)


class KeyPrincipal:
    is_authenticated = True
    is_staff = False
    is_superuser = False
    pk = None


class ProjectKeyAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        return "Bearer"

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header:
            return None
        if not header.startswith("Bearer "):
            raise AuthenticationFailed("Use Bearer authentication")
        token = header[7:]
        if len(token) > 200:
            raise AuthenticationFailed("Invalid API key")
        key = (
            APIKey.objects.select_related("project__organization")
            .filter(digest=digest(token), revoked_at=None)
            .first()
        )
        if (
            not key
            or (key.expires_at and key.expires_at <= timezone.now())
            or key.project.organization.suspended
        ):
            raise AuthenticationFailed("Invalid, expired, or revoked API key")
        ip = client_ip(request)
        if key.ip_allowlist and ip not in key.ip_allowlist:
            raise AuthenticationFailed("IP not allowed")
        rate_limit("key:" + str(key.id), 120, 60)
        APIKey.objects.filter(pk=key.pk).update(last_used_at=timezone.now())
        UsageRecord.objects.create(
            project=key.project,
            kind="api_request",
            reference="api:" + secrets.token_hex(16),
        )
        return KeyPrincipal(), key


def session_only(request):
    if isinstance(request.auth, APIKey):
        raise PermissionDenied("Use a signed-in user session")


def project_for(request, scope=None, write=False, admin=False):
    if isinstance(request.auth, APIKey):
        key = request.auth
        if scope is None or scope not in key.scopes:
            raise PermissionDenied("API key scope required: " + str(scope))
        supplied = (
            request.data.get("project") if isinstance(request.data, dict) else None
        )
        supplied = supplied or request.query_params.get("project")
        if supplied and str(supplied) != str(key.project_id):
            raise PermissionDenied("Project mismatch")
        return key.project
    pid = (
        request.query_params.get("project")
        or request.data.get("project")
        or request.headers.get("X-Project-ID")
    )
    if not pid:
        raise ValidationError({"project": "Select a project"})
    cache_attr = f"_proj_{pid}_{write}_{admin}"
    if hasattr(request, cache_attr):
        return getattr(request, cache_attr)

    from django.core.cache import cache
    user_id = str(getattr(request.user, "pk", ""))
    cache_key = f"proj_perm:{user_id}:{pid}"
    cached_info = cache.get(cache_key)
    if cached_info is not None:
        proj, role, suspended = cached_info
        if suspended:
            raise PermissionDenied("Project unavailable")
        if write and role == "viewer":
            raise PermissionDenied("Viewer access is read-only")
        if admin and role not in ("owner", "admin"):
            raise PermissionDenied("Organization administrator required")
        setattr(request, cache_attr, proj)
        return proj

    try:
        project = Project.objects.select_related("organization").get(pk=pid)
    except (Project.DoesNotExist, ValueError):
        raise PermissionDenied("Project unavailable")
    member = OrganizationMembership.objects.filter(
        user=request.user, organization=project.organization
    ).first()
    if not member or project.organization.suspended:
        raise PermissionDenied("Project unavailable")
    if write and member.role == "viewer":
        raise PermissionDenied("Viewer access is read-only")
    if admin and member.role not in ("owner", "admin"):
        raise PermissionDenied("Organization administrator required")
    cache.set(cache_key, (project, member.role, project.organization.suspended), 30)
    setattr(request, cache_attr, project)
    return project


def audit(request, action, organization=None, target=""):
    AuditLog.objects.create(
        actor=request.user if getattr(request.user, "pk", None) else None,
        organization=organization,
        action=action,
        target=str(target),
    )


def safe_url(url):
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
        or not parsed.hostname
    ):
        raise ValidationError("Only public HTTPS URLs on port 443 are allowed")
    # An operator allowlist is mandatory. An egress proxy must additionally enforce
    # DNS/IP policy is additionally pinned by core.outbound at connection time.
    if parsed.hostname not in settings.WEBHOOK_ALLOWED_HOSTS:
        raise ValidationError(
            "Destination hostname is not in the operator egress allowlist"
        )
    try:
        addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise ValidationError("Destination does not resolve")
    if not addresses or any(
        not ipaddress.ip_address(a[4][0]).is_global for a in addresses
    ):
        raise ValidationError("Private or reserved network destinations are forbidden")
    return url


def sign_webhook(secret, timestamp, body):
    return hmac.new(
        secret.encode(), str(timestamp).encode() + b"." + body, hashlib.sha256
    ).hexdigest()


def verify_webhook(secret, timestamp, body, signature, now=None):
    try:
        if abs((now or time.time()) - int(timestamp)) > 300:
            return False
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(sign_webhook(secret, timestamp, body), signature)


def exception_handler(exc, context):
    from rest_framework.views import exception_handler as drf_handler
    from django.core.exceptions import (
        ValidationError as DjangoValidationError,
        ObjectDoesNotExist,
    )
    from django.db import IntegrityError

    if isinstance(exc, (DjangoValidationError, ObjectDoesNotExist, IntegrityError)):
        exc = ValidationError(
            "Invalid identifier, conflicting record, or invalid field value"
        )
    response = drf_handler(exc, context)
    if response is not None:
        response.data = {
            "error": {
                "code": getattr(exc, "default_code", "invalid_request"),
                "details": response.data,
            }
        }
    return response
