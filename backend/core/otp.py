from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .security import client_ip
import secrets
from datetime import timedelta
from django.contrib.auth.hashers import make_password, check_password
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.core import signing
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .models import OTPChallenge, WhatsAppConnection, AuditLog
from .security import project_for, rate_limit, audit
from .services import queue_message, phone_number, emit

@extend_schema(request=OpenApiTypes.OBJECT,responses=OpenApiTypes.OBJECT)
@api_view(['POST'])
def otp(request, action):
    if action not in ('send','verify'): raise ValidationError('Unknown OTP action')
    project=project_for(request,'otp:'+action,write=True)
    rate_limit('otp-project:'+str(project.id),100,3600)
    rate_limit('otp-ip:'+client_ip(request),30,3600)
    if action=='send':
        phone=phone_number(request.data.get('phone'))
        rate_limit('otp-phone:'+str(project.id)+phone,5,3600)
        rate_limit('otp-cooldown:'+str(project.id)+phone,1,60)
        ttl=request.data.get('ttl_seconds',300)
        if type(ttl) is not int or not 60<=ttl<=600: raise ValidationError('TTL must be 60–600 seconds')
        conn_id = request.data.get('connection')
        if conn_id:
            connection=WhatsAppConnection.objects.filter(pk=conn_id,project=project,status='CONNECTED').first()
        else:
            connection=WhatsAppConnection.objects.filter(project=project,status='CONNECTED').first()
        if not connection: raise ValidationError('Connected transport required')
        experimental = connection.provider == 'baileys'
        if experimental and not (settings.BAILEYS_ENABLED and settings.BAILEYS_OTP_ENABLED):
            raise ValidationError('Experimental QR OTP is disabled. Enable BAILEYS_OTP_ENABLED explicitly for research use.')
        if connection.provider not in ('sandbox','meta','baileys'): raise ValidationError('Unsupported OTP provider')
        code=f'{secrets.randbelow(1000000):06d}'
        kind='text';payload={'body':f'Your verification code is {code}. Valid for {ttl//60} minutes.'}
        if connection.provider=='meta':
            # Only operator-vetted authentication templates may carry real OTPs.
            allowed=getattr(settings,'OTP_TEMPLATE_NAMES',[])
            name=request.data.get('template')
            if name not in allowed: raise ValidationError('Use an operator-approved Meta authentication template')
            kind='template';payload={'name':name,'language':request.data.get('language','en_US'),'components':[{'type':'body','parameters':[{'type':'text','text':code}]},{'type':'button','sub_type':'url','index':'0','parameters':[{'type':'text','text':code}]}]}
        with transaction.atomic():
            # One active challenge per phone. A resend invalidates previous codes.
            from .models import Project
            Project.objects.select_for_update().get(pk=project.pk)
            OTPChallenge.objects.filter(project=project,phone=phone,verified_at=None).update(expires_at=timezone.now())
            challenge=OTPChallenge.objects.create(project=project,phone=phone,code_hash=make_password(code),expires_at=timezone.now()+timedelta(seconds=ttl))
            msg,_=queue_message(project,{'connection':str(connection.id),'phone':phone,'kind':kind,'payload':payload},'otp:'+str(challenge.id),otp=True)
            challenge.message=msg;challenge.save()
            audit(request,'otp.created',project.organization,challenge.id)
        result={'challenge_id':str(challenge.id),'expires_at':challenge.expires_at,'status':'queued'}
        if experimental: result.update(experimental=True, delivery_guaranteed=False)
        if project.sandbox and connection.provider=='sandbox': result['sandbox_code']=code
        return Response(result,status=202)
    rate_limit('otp-verify:'+str(project.id),120,3600)
    code=str(request.data.get('code',''))
    if len(code)!=6 or not code.isdigit(): raise ValidationError('A six-digit code is required')
    # Persist failed attempt counters; do not raise inside the transaction.
    with transaction.atomic():
        challenge=OTPChallenge.objects.select_for_update().filter(pk=request.data.get('challenge_id'),project=project).first()
        valid=False
        if challenge and not challenge.verified_at and challenge.expires_at>timezone.now() and challenge.attempts<5:
            challenge.attempts+=1
            valid=check_password(code,challenge.code_hash)
            if valid: challenge.verified_at=timezone.now();challenge.code_hash=''
            challenge.save()
            AuditLog.objects.create(organization=project.organization,action='otp.verified' if valid else 'otp.failed',target=str(challenge.id))
            if valid: emit(project,'otp.verified',{'challenge_id':str(challenge.id)})
    if not valid: return Response({'error':{'code':'invalid_challenge','details':'Invalid, expired, used, or locked challenge'}},status=400)
    proof=signing.dumps({'purpose':'phone_verification','project':str(project.id),'challenge':str(challenge.id),'phone':challenge.phone,'simulated':challenge.message.connection.provider=='sandbox'},salt='whatsbridge-phone-verification-v1')
    return Response({'verified':True,'verification_token':proof,'expires_in':300,'token_type':'phone_verification'})
