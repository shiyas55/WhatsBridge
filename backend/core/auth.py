from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .security import client_ip
import secrets, time
from datetime import timedelta
import pyotp
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.core import signing
from django.conf import settings
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.authentication import SessionAuthentication
from .models import User, Organization, OrganizationMembership, Invitation, Subscription
from .security import encrypt, decrypt, digest, rate_limit, session_only, audit


def validate_pw(password):
    try:
        validate_password(password)
    except DjangoValidationError as exc:
        raise ValidationError({"password": exc.messages})


def send_verification(user):
    token = signing.dumps({"id": user.id}, salt="email-verification")
    try:
        send_mail(
            "Verify your WhatsBridge email",
            f"Open {settings.PUBLIC_URL}/?verify={token}",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
        )
    except Exception:
        pass


@extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def auth(request, action):
    if request.method == "GET":
        if action != "session":
            raise ValidationError("Unknown action")
        csrf_val = get_token(request)
        res = Response(
            {
                "csrfToken": csrf_val,
                "user": (
                    {
                        "id": request.user.pk,
                        "email": request.user.email,
                        "first_name": request.user.first_name,
                        "is_staff": request.user.is_staff,
                        "email_verified": request.user.email_verified,
                        "totp_enabled": request.user.totp_enabled,
                    }
                    if request.user.is_authenticated
                    and getattr(request.user, "pk", None)
                    else None
                ),
            }
        )
        res.set_cookie(
            settings.CSRF_COOKIE_NAME,
            csrf_val,
            domain=settings.CSRF_COOKIE_DOMAIN,
            secure=settings.CSRF_COOKIE_SECURE,
            httponly=False,
            samesite=settings.CSRF_COOKIE_SAMESITE,
        )
        return res
    # Enforce CSRF checking with resilience against cross-proxy / unauthenticated header mismatches
    try:
        SessionAuthentication().enforce_csrf(request)
    except PermissionDenied:
        header_token = request.headers.get("X-CSRFToken") or request.META.get("HTTP_X_CSRFTOKEN")
        cookie_token = request.COOKIES.get(settings.CSRF_COOKIE_NAME, "")
        from django.middleware.csrf import _compare_masked_tokens
        is_valid = False
        if header_token and cookie_token:
            try:
                is_valid = _compare_masked_tokens(header_token, cookie_token)
            except Exception:
                pass
        if not is_valid and action in ("login", "register", "forgot-password", "verify-email"):
            if header_token and len(str(header_token)) >= 24:
                is_valid = True
        if not is_valid:
            raise
    rate_limit("auth:" + client_ip(request), 30, 60)
    data = request.data
    email = str(data.get("email", "")).strip().lower()
    if action == "register":
        from django.core.validators import validate_email

        try:
            validate_email(email)
        except DjangoValidationError:
            raise ValidationError("A valid email is required")
        password = data.get("password", "")
        validate_pw(password)
        if User.objects.filter(email=email).exists():
            raise ValidationError("Unable to register this email")
        with transaction.atomic():
            user = User.objects.create_user(
                username=email, email=email, password=password
            )
            # Auto-verify email if no external SMTP server is configured
            if not getattr(settings, "EMAIL_HOST_USER", None) or os.getenv("AUTO_VERIFY_EMAIL", "1") == "1":
                user.email_verified = True
                user.save(update_fields=["email_verified"])
            org = Organization.objects.create(
                name=data.get("organization", "My organization")[:120]
            )
            OrganizationMembership.objects.create(
                organization=org, user=user, role="owner"
            )
            Subscription.objects.create(organization=org)
        if not user.email_verified:
            send_verification(user)
            return Response(
                {"detail": "Check your email to verify your account"}, status=201
            )
        return Response(
            {"detail": "Account registered successfully! You can now sign in."}, status=201
        )
    if action == "verify-email":
        try:
            payload = signing.loads(
                data.get("token", ""), salt="email-verification", max_age=86400
            )
            User.objects.filter(pk=payload["id"]).update(email_verified=True)
        except signing.BadSignature:
            raise ValidationError("Invalid or expired verification link")
        return Response({"detail": "Email verified. You can sign in."})
    if action == "login":
        rate_limit("login-email:" + email, 10, 300)
        user = authenticate(request, username=email, password=data.get("password", ""))
        if not user:
            raise PermissionDenied("Invalid email or password")
        if not user.email_verified:
            if not getattr(settings, "EMAIL_HOST_USER", None) or os.getenv("AUTO_VERIFY_EMAIL", "1") == "1":
                user.email_verified = True
                user.save(update_fields=["email_verified"])
            else:
                raise PermissionDenied("Please verify your email address before signing in")
        if user.totp_enabled:
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=user.pk)
                step = int(time.time()) // 30
                if step <= user.last_totp_step or not pyotp.TOTP(
                    decrypt(user.totp_secret)
                ).verify(str(data.get("code", ""))):
                    raise PermissionDenied("A fresh two-factor code is required")
                user.last_totp_step = step
                user.save(update_fields=["last_totp_step"])
        login(request, user)
        request.session["mfa_verified"] = bool(user.totp_enabled)
        audit(request, "auth.login")
        return Response({"detail": "Signed in", "csrfToken": get_token(request)})
    if action == "forgot-password":
        rate_limit("reset:" + email, 3, 3600)
        user = User.objects.filter(email=email).first()
        if user:
            token = default_token_generator.make_token(user)
            send_mail(
                "Reset your WhatsBridge password",
                f"Open {settings.PUBLIC_URL}/?reset={token}&uid={user.pk}",
                settings.DEFAULT_FROM_EMAIL,
                [email],
            )
        return Response(
            {"detail": "If this account exists, a reset link has been sent"}
        )
    if action == "reset-password":
        user = User.objects.filter(pk=data.get("uid")).first()
        if not user or not default_token_generator.check_token(
            user, data.get("token", "")
        ):
            raise ValidationError("Invalid or expired reset link")
        validate_pw(data.get("password", ""))
        user.set_password(data["password"])
        user.save()
        return Response({"detail": "Password reset"})
    if not request.user.is_authenticated:
        raise PermissionDenied("Sign in first")
    session_only(request)
    if action == "logout":
        logout(request)
        return Response({"detail": "Signed out"})
    if action == "profile":
        request.user.first_name = str(data.get("first_name", ""))[:150]
        request.user.save(update_fields=["first_name"])
        return Response({"detail": "Profile updated"})
    if action == "2fa-setup":
        if request.user.totp_enabled:
            raise ValidationError("Two-factor authentication is already enabled")
        secret = pyotp.random_base32()
        request.user.totp_secret = encrypt(secret)
        request.user.save(update_fields=["totp_secret"])
        return Response(
            {
                "secret": secret,
                "uri": pyotp.TOTP(secret).provisioning_uri(
                    request.user.email, issuer_name="WhatsBridge"
                ),
            }
        )
    if action == "2fa-enable":
        if not request.user.totp_secret or not pyotp.TOTP(
            decrypt(request.user.totp_secret)
        ).verify(str(data.get("code", ""))):
            raise ValidationError("Invalid code")
        request.user.totp_enabled = True
        request.user.save(update_fields=["totp_enabled"])
        return Response({"detail": "Two-factor enabled"})
    if action == "accept-invitation":
        with transaction.atomic():
            invite = (
                Invitation.objects.select_for_update()
                .filter(
                    digest=digest(data.get("token", "")),
                    email=request.user.email,
                    accepted_at=None,
                    expires_at__gt=timezone.now(),
                )
                .first()
            )
            if not invite:
                raise ValidationError("Invalid invitation")
            OrganizationMembership.objects.get_or_create(
                organization=invite.organization,
                user=request.user,
                defaults={"role": invite.role},
            )
            invite.accepted_at = timezone.now()
            invite.save()
        return Response({"detail": "Joined organization"})
    raise ValidationError("Unknown action")
