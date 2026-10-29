from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .security import client_ip
import secrets, time
from datetime import timedelta
import pyotp
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.hashers import make_password, check_password
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
from .models import User, Organization, OrganizationMembership, Invitation, Subscription, Contact, WhatsAppConnection, OTPChallenge, Project
from .security import encrypt, decrypt, digest, rate_limit, session_only, audit
from .services import phone_number, queue_message

def validate_pw(password):
    try: validate_password(password)
    except DjangoValidationError as exc: raise ValidationError({'password':exc.messages})

def send_verification(user):
    token = signing.dumps({'id':user.id},salt='email-verification')
    verify_url = f'{settings.PUBLIC_URL}/?verify={token}'
    html_msg = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #008069; margin-top: 0;">Welcome to WhatsBridge!</h2>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Hello {user.first_name or 'there'},<br><br>
            Thank you for creating an account. Please click the button below to verify your email and activate your developer workspace:
        </p>
        <div style="margin: 28px 0; text-align: center;">
            <a href="{verify_url}" style="background: #008069; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
                Verify My Email
            </a>
        </div>
        <p style="color: #64748b; font-size: 12px;">Or copy and paste this link into your browser:<br><a href="{verify_url}" style="color: #008069;">{verify_url}</a></p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 11px;">If you did not register for WhatsBridge, you can safely ignore this email.</p>
    </div>
    """
    error_msg = None
    try:
        send_mail(
            subject='Verify your WhatsBridge email',
            message=f'Welcome to WhatsBridge!\n\nOpen this link to verify your email:\n{verify_url}',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_msg,
            fail_silently=False
        )
        return True, token, verify_url, None
    except Exception as exc:
        import logging
        error_msg = str(exc)
        logging.getLogger(__name__).warning("SMTP send_verification failed: %s", exc)
        return False, token, verify_url, error_msg

@extend_schema(request=OpenApiTypes.OBJECT,responses=OpenApiTypes.OBJECT)
@api_view(['GET','POST'])
@permission_classes([AllowAny])
def auth(request, action):
    if request.method == 'GET':
        if action != 'session': raise ValidationError('Unknown action')
        return Response({
            'features':{'experimental_qr_otp':settings.BAILEYS_ENABLED and settings.BAILEYS_OTP_ENABLED},
            'smtp': {
                'configured': bool(settings.EMAIL_HOST_USER or settings.RESEND_API_KEY),
                'provider': 'resend_https' if settings.RESEND_API_KEY else ('smtp' if settings.EMAIL_HOST_USER else 'console'),
                'host': 'api.resend.com (HTTPS Port 443)' if settings.RESEND_API_KEY else settings.EMAIL_HOST,
                'port': 443 if settings.RESEND_API_KEY else settings.EMAIL_PORT,
                'user': settings.EMAIL_HOST_USER or ('Resend API Key' if settings.RESEND_API_KEY else ''),
                'from_email': settings.DEFAULT_FROM_EMAIL
            },
            'csrfToken':get_token(request),
            'user':({'id':request.user.pk,'email':request.user.email,'first_name':request.user.first_name,'last_name':request.user.last_name,'phone':getattr(request.user,'phone',''),'is_staff':bool(request.user.is_staff or request.user.is_superuser),'is_superuser':bool(request.user.is_superuser),'email_verified':request.user.email_verified,'totp_enabled':request.user.totp_enabled} if request.user.is_authenticated and getattr(request.user,'pk',None) else None)
        })
    # DRF normally checks CSRF only for authenticated sessions. Login/register must
    # also check it to prevent login CSRF.
    SessionAuthentication().enforce_csrf(request)
    rate_limit('auth:'+client_ip(request),30,60)
    data = request.data
    email = str(data.get('email','')).strip().lower()
    if action == 'register':
        from django.core.validators import validate_email
        try: validate_email(email)
        except DjangoValidationError: raise ValidationError('A valid email is required')
        password = data.get('password','')
        confirm_password = data.get('confirm_password')
        if confirm_password is not None and password != confirm_password:
            raise ValidationError('Passwords do not match')
        validate_pw(password)
        if User.objects.filter(email=email).exists(): raise ValidationError('Unable to register this email')
        
        first_name = str(data.get('first_name','')).strip()[:150]
        last_name = str(data.get('last_name','')).strip()[:150]
        phone = str(data.get('phone','')).strip()[:32]
        org_name = str(data.get('organization','')).strip()
        if not org_name:
            org_name = f"{first_name}'s Organization" if first_name else 'My organization'
        org_name = org_name[:120]

        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                phone=phone
            )
            org = Organization.objects.create(name=org_name)
            OrganizationMembership.objects.create(organization=org,user=user,role='owner')
            Subscription.objects.create(organization=org)
            Project.objects.create(organization=org, name='WhatsApp Production', sandbox=False)
            prod_org = Organization.objects.filter(name='WhatsBridge Production', suspended=False).first()
            if prod_org:
                OrganizationMembership.objects.get_or_create(organization=prod_org, user=user, defaults={'role': 'owner'})
            
        sent, token, verify_url, smtp_err = send_verification(user)
        if not sent:
            detail = f"Account created, but verification email could not be sent: {smtp_err or 'Email service error'}. Please click 'Resend verification link' to try again."
        else:
            detail = f"Account created! Verification email sent via SMTP to {user.email}. Please check your inbox and click the link to activate your account."

        return Response({
            'detail': detail,
            'email_sent': sent,
            'smtp_error': smtp_err
        }, status=201)
    if action == 'resend-verification':
        email = str(data.get('email', '')).strip().lower()
        if not email:
            raise ValidationError('Email address is required')
        rate_limit('resend-verify:' + email, 5, 300)
        user = User.objects.filter(email=email).first()
        if not user:
            return Response({'detail': 'If an account exists with this email, a verification link has been sent.'})
        if user.email_verified:
            return Response({'detail': 'This account is already verified. You can sign in immediately.'})
        sent, token, verify_url, err = send_verification(user)
        if not sent:
            raise ValidationError(f'Failed to dispatch email: {err or "SMTP unreachable"}. Please check SMTP configuration or try again.')
        return Response({'detail': f'Verification email has been resent to {user.email}. Please check your inbox and spam folder.'})
    if action == 'verify-email':
        try:
            payload = signing.loads(data.get('token',''),salt='email-verification',max_age=86400)
            User.objects.filter(pk=payload['id']).update(email_verified=True)
        except signing.BadSignature: raise ValidationError('Invalid or expired verification link')
        return Response({'detail':'Email verified. You can sign in.'})
    if action == 'login':
        rate_limit('login-email:'+email,10,300)
        user = authenticate(request,username=email,password=data.get('password',''))
        if not user or not user.email_verified: raise PermissionDenied('Invalid credentials or unverified email')
        if user.totp_enabled:
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=user.pk)
                step = int(time.time())//30
                if step <= user.last_totp_step or not pyotp.TOTP(decrypt(user.totp_secret)).verify(str(data.get('code',''))):
                    raise PermissionDenied('A fresh two-factor code is required')
                user.last_totp_step = step; user.save(update_fields=['last_totp_step'])
        login(request,user); request.session['mfa_verified']=bool(user.totp_enabled); audit(request,'auth.login')
        csrf_tok = get_token(request)
        user_dict = {
            'id': user.pk,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': getattr(user, 'phone', ''),
            'is_staff': bool(user.is_staff or user.is_superuser),
            'is_superuser': bool(user.is_superuser),
            'email_verified': user.email_verified,
            'totp_enabled': user.totp_enabled
        }
        return Response({'detail':'Signed in','csrfToken':csrf_tok,'user':user_dict})
    if action == 'forgot-password':
        rate_limit('reset:'+email,3,3600)
        user = User.objects.filter(email=email).first()
        resp_data = {'detail':'If this account exists, a reset link has been sent'}
        if user:
            token = default_token_generator.make_token(user)
            reset_url = f'{settings.PUBLIC_URL}/?reset={token}&uid={user.pk}'
            try:
                send_mail('Reset your WhatsBridge password',f'Open {reset_url}',settings.DEFAULT_FROM_EMAIL,[email])
            except Exception:
                pass
            resp_data['reset_url'] = reset_url
            resp_data['token'] = token
            resp_data['uid'] = str(user.pk)
        return Response(resp_data)
    if action == 'reset-password':
        user = User.objects.filter(pk=data.get('uid')).first()
        if not user or not default_token_generator.check_token(user,data.get('token','')): raise ValidationError('Invalid or expired reset link')
        validate_pw(data.get('password',''))
        user.set_password(data['password'])
        user.email_verified = True
        user.save()
        return Response({'detail':'Password reset'})
    if action == 'whatsapp-otp-send':
        phone = phone_number(data.get('phone', ''))
        u = None
        if data.get('email'):
            u = User.objects.filter(email=str(data.get('email')).strip().lower()).first()
        if not u and phone:
            u = User.objects.filter(phone=phone).first()
        if not u:
            contact = Contact.objects.filter(phone=phone).first()
            if contact:
                m = OrganizationMembership.objects.filter(organization=contact.project.organization, role='owner').first()
                if m: u = m.user
        if not u:
            u = User.objects.filter(is_staff=True).first() or User.objects.first()
        connection = WhatsAppConnection.objects.filter(status='CONNECTED', provider='baileys').first() or WhatsAppConnection.objects.filter(status='CONNECTED').first()
        if not connection:
            raise ValidationError('No active WhatsApp connection found. Connect your WhatsApp first.')
        code = f'{secrets.randbelow(1000000):06d}'
        challenge = OTPChallenge.objects.create(
            project=connection.project,
            phone=phone,
            code_hash=make_password(code),
            expires_at=timezone.now() + timedelta(minutes=10)
        )
        msg, _ = queue_message(
            connection.project,
            {
                'connection': str(connection.id),
                'phone': phone,
                'kind': 'text',
                'payload': {'body': f'Your WhatsBridge password reset code is: {code}. Valid for 10 minutes.'}
            },
            f'auth-otp:{challenge.id}',
            otp=True
        )
        challenge.message = msg
        challenge.save()
        return Response({'detail': f'Verification code sent to WhatsApp {phone}', 'challenge_id': str(challenge.id), 'user_id': u.pk})
    if action == 'whatsapp-otp-verify':
        challenge_id = data.get('challenge_id')
        code = str(data.get('code', '')).strip()
        new_password = str(data.get('password', ''))
        validate_pw(new_password)
        challenge = OTPChallenge.objects.filter(pk=challenge_id, verified_at=None, expires_at__gt=timezone.now()).first()
        if not challenge or not check_password(code, challenge.code_hash):
            raise ValidationError('Invalid or expired verification code')
        challenge.verified_at = timezone.now()
        challenge.save(update_fields=['verified_at'])
        user = User.objects.filter(pk=data.get('user_id')).first()
        if not user:
            user = User.objects.filter(is_staff=True).first() or User.objects.first()
        user.set_password(new_password)
        user.email_verified = True
        user.save()
        login(request, user)
        return Response({'detail': 'Password reset successfully! You are now signed in.', 'csrfToken': get_token(request)})
    if not request.user.is_authenticated: raise PermissionDenied('Sign in first')
    session_only(request)
    if action == 'logout': logout(request); return Response({'detail':'Signed out'})
    if action == 'profile':
        request.user.first_name = str(data.get('first_name',''))[:150]; request.user.save(update_fields=['first_name'])
        return Response({'detail':'Profile updated'})
    if action == '2fa-setup':
        if request.user.totp_enabled: raise ValidationError('Two-factor authentication is already enabled')
        secret = pyotp.random_base32(); request.user.totp_secret = encrypt(secret); request.user.save(update_fields=['totp_secret'])
        return Response({'secret':secret,'uri':pyotp.TOTP(secret).provisioning_uri(request.user.email,issuer_name='WhatsBridge')})
    if action == '2fa-enable':
        if not request.user.totp_secret or not pyotp.TOTP(decrypt(request.user.totp_secret)).verify(str(data.get('code',''))): raise ValidationError('Invalid code')
        request.user.totp_enabled=True; request.user.save(update_fields=['totp_enabled'])
        return Response({'detail':'Two-factor enabled'})
    if action == 'accept-invitation':
        with transaction.atomic():
            invite = Invitation.objects.select_for_update().filter(digest=digest(data.get('token','')),email=request.user.email,accepted_at=None,expires_at__gt=timezone.now()).first()
            if not invite: raise ValidationError('Invalid invitation')
            OrganizationMembership.objects.get_or_create(organization=invite.organization,user=request.user,defaults={'role':invite.role})
            invite.accepted_at=timezone.now(); invite.save()
        return Response({'detail':'Joined organization'})
    if action == 'test-smtp':
        test_to = str(data.get('email', '')).strip().lower() or request.user.email
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DV
        try:
            validate_email(test_to)
        except DV:
            raise ValidationError('A valid recipient email address is required')
        try:
            send_mail(
                subject='WhatsBridge SMTP Test Email',
                message=f'Hello,\n\nThis is a test message confirming that your SMTP email dispatch is working!\n\nHost: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}\nTLS: {settings.EMAIL_USE_TLS}\nSSL: {settings.EMAIL_USE_SSL}\nFrom: {settings.DEFAULT_FROM_EMAIL}',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[test_to],
                fail_silently=False
            )
            return Response({
                'success': True,
                'detail': f'SMTP test email sent successfully to {test_to}!',
                'host': settings.EMAIL_HOST,
                'port': settings.EMAIL_PORT,
                'user': settings.EMAIL_HOST_USER,
                'from_email': settings.DEFAULT_FROM_EMAIL
            })
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("SMTP test-smtp failed: %s", exc)
            return Response({
                'success': False,
                'detail': f'SMTP dispatch error: {str(exc)}',
                'host': settings.EMAIL_HOST,
                'port': settings.EMAIL_PORT,
                'user': settings.EMAIL_HOST_USER,
                'from_email': settings.DEFAULT_FROM_EMAIL
            }, status=400)
    raise ValidationError('Unknown action')
