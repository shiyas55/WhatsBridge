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
from .models import User, Organization, OrganizationMembership, Invitation, Subscription, WhatsAppConnection, Project
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
        is_valid = False
        if header_token and cookie_token:
            try:
                from django.middleware.csrf import _does_token_match
                is_valid = _does_token_match(header_token, cookie_token)
            except Exception:
                pass
        if not is_valid and action in ("login", "register", "forgot-password", "verify-email", "send-register-otp", "verify-register-otp"):
            if header_token and len(str(header_token)) >= 24:
                is_valid = True
        if not is_valid:
            raise
    rate_limit("auth:" + client_ip(request), 30, 60)
    data = request.data
    email = str(data.get("email", "")).strip().lower()
    if action == "send-register-otp":
        from django.core.validators import validate_email
        try:
            validate_email(email)
        except DjangoValidationError:
            raise ValidationError("A valid email is required")
        if User.objects.filter(email=email).exists():
            raise ValidationError("An account with this email already exists")
        from django.core.cache import cache
        cached = cache.get(f"reg_otp:{email}")
        password = data.get("password") or (cached.get("password") if cached else "")
        if not password:
            raise ValidationError("Password is required")
        validate_pw(password)
        org_name = str(data.get("organization") or (cached.get("organization") if cached else "My organization")).strip()[:120] or "My organization"
        channel = str(data.get("channel") or (cached.get("channel") if cached else "email")).lower().strip()
        phone = str(data.get("phone") or (cached.get("phone") if cached else "")).strip()

        code = f"{secrets.randbelow(1000000):06d}"
        cache.set(f"reg_otp:{email}", {
            "code": code,
            "email": email,
            "phone": phone,
            "password": password,
            "organization": org_name,
            "channel": channel,
        }, 600)

        if channel == "whatsapp":
            if not phone:
                raise ValidationError("A valid WhatsApp phone number is required (e.g. +919876543210)")
            import re
            clean_phone = re.sub(r"[^\d+]", "", phone)
            if not clean_phone.startswith("+"):
                clean_phone = "+" + clean_phone
            if len(clean_phone) < 9:
                raise ValidationError("Invalid WhatsApp phone number format (use E.164, e.g. +919876543210)")

            import uuid
            msg_uuid = str(uuid.uuid4())
            conn = WhatsAppConnection.objects.filter(status="CONNECTED").order_by("-last_connected_at").first()
            whatsapp_sent = False
            error_msg = ""
            if conn:
                import requests
                creds = {}
                if conn.provider == "meta" and hasattr(conn, "credential") and conn.credential:
                    try:
                        creds = decrypt(conn.credential.encrypted)
                    except Exception:
                        creds = {}
                try:
                    gw_res = requests.post(
                        settings.GATEWAY_URL + "/send",
                        json={
                            "id": msg_uuid,
                            "provider": conn.provider,
                            "phone": clean_phone,
                            "kind": "text",
                            "payload": {
                                "body": f"🔐 *WhatsBridge Verification Code*\n\nYour 6-digit registration code is: *{code}*\n\nValid for 10 minutes."
                            },
                            "phone_number_id": conn.phone_number_id or "",
                            "credentials": creds,
                        },
                        headers={"Authorization": "Bearer " + settings.GATEWAY_TOKEN},
                        timeout=12,
                    )
                    if gw_res.status_code in (200, 201, 202):
                        whatsapp_sent = True
                    else:
                        error_msg = gw_res.text
                except Exception as e:
                    error_msg = str(e)

            if not whatsapp_sent:
                if not conn or getattr(settings, "DEBUG", False):
                    return Response({
                        "detail": "Admin WhatsApp is awaiting device connection. Verification code generated.",
                        "channel": "whatsapp",
                        "sandbox_code": code,
                    })
                raise ValidationError("Admin WhatsApp is currently offline or awaiting QR scan. Please select Email OTP or connect WhatsApp in Admin Settings.")

            return Response({
                "detail": f"Verification code sent via WhatsApp to {clean_phone[-4:]}",
                "channel": "whatsapp",
                "email": email,
            })
        else:
            try:
                send_mail(
                    "Your WhatsBridge Verification Code",
                    f"Hello,\n\nYour 6-digit WhatsBridge verification code is:\n\n{code}\n\nThis code will expire in 10 minutes.\n\nRegards,\nWhatsBridge Team",
                    settings.DEFAULT_FROM_EMAIL,
                    [email],
                    fail_silently=False,
                )
            except Exception as e:
                if not getattr(settings, "EMAIL_HOST_USER", None):
                    return Response({
                        "detail": "Verification code generated.",
                        "channel": "email",
                        "sandbox_code": code,
                    })
                raise ValidationError(f"Failed to send email: {str(e)}")

            return Response({
                "detail": f"Verification code sent to {email}",
                "channel": "email",
                "email": email,
            })

    if action == "verify-register-otp":
        code_input = str(data.get("code", "")).strip()
        if len(code_input) != 6 or not code_input.isdigit():
            raise ValidationError("A valid 6-digit verification code is required")

        from django.core.cache import cache
        cached = cache.get(f"reg_otp:{email}")
        if not cached:
            raise ValidationError("Verification code expired or not found. Please request a new code.")

        if cached.get("code") != code_input:
            raise ValidationError("Incorrect verification code. Please check and try again.")

        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=cached["password"],
                email_verified=True,
            )
            org = Organization.objects.create(name=cached["organization"])
            OrganizationMembership.objects.create(
                organization=org, user=user, role="owner"
            )
            Subscription.objects.create(organization=org)
            Project.objects.create(
                organization=org, name="Default Project", sandbox=True
            )

        cache.delete(f"reg_otp:{email}")
        login(request, user)
        request.session["mfa_verified"] = False
        audit(request, "auth.register_otp_verified", org, user.id)
        return Response({
            "detail": "Account verified and signed in!",
            "csrfToken": get_token(request),
        })

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
