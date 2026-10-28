import json, time
from datetime import timedelta
import requests
from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import *
from .security import decrypt, safe_url, sign_webhook
from .outbound import post as outbound_post
from .services import emit, queue_message, consent_for

@shared_task
def dispatch_due():
    now = timezone.now()
    from django.core.cache import cache
    cache.set('worker:last_dispatch', now.isoformat(), 120)
    for mid in Message.objects.filter(status='queued',scheduled_at__lte=now).values_list('id',flat=True)[:200]: send_message.delay(str(mid))
    for wid in WebhookDelivery.objects.filter(status='pending',next_attempt_at__lte=now).values_list('id',flat=True)[:200]: deliver_webhook.delay(str(wid))
    for eid in WorkflowExecution.objects.filter(status__in=['queued','waiting'],resume_at__lte=now).values_list('id',flat=True)[:100]: run_workflow.delay(str(eid))
    sync_experimental_receipts()
    # Webhook replay is safe because each delivery retains the same event ID.
    WebhookDelivery.objects.filter(status='processing',next_attempt_at__lt=now-timedelta(minutes=5)).update(status='pending',next_attempt_at=now)
    WorkflowExecution.objects.filter(status='running',resume_at__lt=now-timedelta(hours=1)).update(status='failed',error='Interrupted execution; inspect side effects before manual retry')
    # Never automatically resend a send whose outcome is unknown after a crash.
    Message.objects.filter(status='processing',scheduled_at__lt=now-timedelta(minutes=10)).update(status='unknown',error='Worker interrupted; reconcile with provider before retrying')

@shared_task
def send_message(message_id):
    now = timezone.now()
    with transaction.atomic():
        msg = Message.objects.select_for_update().select_related('connection','project__organization').get(pk=message_id)
        if msg.status != 'queued' or msg.scheduled_at > now: return
        is_otp = 'encrypted_otp' in msg.payload
        consent = consent_for(msg.project,msg.phone,'otp' if is_otp else 'messaging')
        if msg.project.organization.suspended or msg.connection.status != 'CONNECTED' or not consent or not consent.granted:
            msg.status='failed'; msg.error='Transport unavailable or consent revoked'; msg.save(); emit(msg.project,'message.failed',{'message_id':str(msg.id)}); return
        if is_otp and OTPChallenge.objects.filter(message=msg,expires_at__lte=now).exists():
            msg.status='failed'; msg.error='OTP expired before dispatch'; msg.payload={}; msg.save(); return
        if msg.connection.provider == 'meta' and msg.kind != 'template' and not Message.objects.filter(project=msg.project,connection=msg.connection,phone=msg.phone,direction='inbound',created_at__gte=now-timedelta(hours=24)).exists():
            msg.status='failed'; msg.error='Customer service window expired'; msg.save(); return
        msg.status='processing'; msg.attempts+=1; msg.scheduled_at=now; msg.save()
    payload = decrypt(msg.payload['encrypted_otp']) if is_otp else msg.payload
    credentials = decrypt(msg.connection.credential.encrypted) if msg.connection.provider == 'meta' else {}
    try:
        url=settings.GATEWAY_URL+'/send';service_token=settings.GATEWAY_TOKEN
        if msg.connection.provider=='baileys':
            if not settings.BAILEYS_ENABLED or (is_otp and not settings.BAILEYS_OTP_ENABLED):
                Message.objects.filter(pk=msg.pk).update(status='failed',error='WhatsApp connector is disabled');return
            from .experimental import endpoint
            url=endpoint(msg.connection)+'/send';service_token=settings.BAILEYS_TOKEN or settings.GATEWAY_TOKEN or ''
        response = requests.post(url,json={'id':str(msg.id),'provider':msg.connection.provider,'phone':msg.phone,'kind':msg.kind,'payload':payload,'phone_number_id':msg.connection.phone_number_id,'credentials':credentials},headers={'Authorization':'Bearer '+service_token},timeout=30)
        result = response.json()
        if response.status_code == 429 or (response.status_code >= 500 and result.get('safe_to_retry') is True):
            with transaction.atomic():
                current=Message.objects.select_for_update().get(pk=msg.pk)
                current.status='queued' if current.attempts < 5 else 'failed'
                current.scheduled_at=timezone.now()+timedelta(seconds=min(3600,2**current.attempts*10))
                current.error='Transient provider rejection' if current.status=='queued' else 'Retry limit exceeded (dead letter)'; current.save()
                if current.status=='failed': emit(msg.project,'message.failed',{'message_id':str(msg.id)})
            return
        if response.status_code == 202 and result.get('status') == 'unknown':
            Message.objects.filter(pk=msg.pk,status='processing').update(status='unknown',error='Provider outcome unknown; reconcile manually'); return
        response.raise_for_status()
        with transaction.atomic():
            current=Message.objects.select_for_update().get(pk=msg.pk)
            current.provider_id=result['provider_id']
            if current.status == 'processing': current.status='accepted'
            if is_otp: current.payload={}
            current.save()
            UsageRecord.objects.get_or_create(reference='accepted:'+str(msg.id),defaults={'project':msg.project,'kind':'message_accepted'})
            if msg.connection.provider == 'sandbox':
                for status in ['sent','delivered']:
                    current.status=status
                    MessageEvent.objects.get_or_create(event_key=f'sandbox:{msg.id}:{status}',defaults={'message':current,'status':status})
                    emit(msg.project,'message.'+status,{'message_id':str(msg.id),'simulated':True})
                current.save()
    except (requests.Timeout,requests.ConnectionError,ValueError,KeyError):
        Message.objects.filter(pk=msg.pk,status='processing').update(status='unknown',error='Ambiguous provider response; automatic retry disabled')
    except requests.HTTPError:
        with transaction.atomic():
            Message.objects.filter(pk=msg.pk,status='processing').update(status='failed',error='Provider rejected the request')
            emit(msg.project,'message.failed',{'message_id':str(msg.id)})

@shared_task
def deliver_webhook(delivery_id):
    with transaction.atomic():
        delivery = WebhookDelivery.objects.select_for_update().select_related('endpoint__project__organization').get(pk=delivery_id)
        if delivery.status != 'pending' or delivery.next_attempt_at > timezone.now(): return
        if not delivery.endpoint.enabled or delivery.endpoint.project.organization.suspended: return
        delivery.status='processing'; delivery.attempts+=1; delivery.save()
    body=json.dumps(delivery.payload,separators=(',',':')).encode(); timestamp=str(int(time.time()))
    try:
        safe_url(delivery.endpoint.url)
        response_code=outbound_post(delivery.endpoint.url,body,headers={'Content-Type':'application/json','X-WhatsBridge-ID':str(delivery.event_id),'X-WhatsBridge-Timestamp':timestamp,'X-WhatsBridge-Signature':sign_webhook(decrypt(delivery.endpoint.encrypted_secret),timestamp,body)},timeout=10)
        delivery.response_code=response_code
        success=200 <= response_code < 300
    except Exception: success=False
    delivery.status='delivered' if success else ('dead' if delivery.attempts >= 6 else 'pending')
    delivery.next_attempt_at=timezone.now()+timedelta(seconds=2**delivery.attempts*15)
    delivery.save()

@shared_task
def run_workflow(execution_id):
    with transaction.atomic():
        run=WorkflowExecution.objects.select_for_update().select_related('project__organization','workflow').get(pk=execution_id)
        if run.status not in ['queued','waiting'] or run.resume_at > timezone.now(): return
        if run.workflow.status=='paused' or run.project.organization.suspended: return
        run.status='running';run.save()
    try:
        while run.cursor < len(run.graph):
            node=run.graph[run.cursor]; kind=node['type']
            if kind=='send_message':
                connection=WhatsAppConnection.objects.get(pk=node['connection'],project=run.project)
                if run.test_mode and connection.provider != 'sandbox': raise ValueError('Test runs require sandbox transport')
                msg,_=queue_message(run.project,{'connection':str(connection.id),'phone':run.context.get('phone'),'kind':node.get('kind','text'),'payload':node.get('payload',{})},f'workflow:{run.id}:{run.cursor}')
                run.context['last_message_id']=str(msg.id)
            elif kind=='condition':
                if run.context.get(node['field']) != node.get('equals'): run.cursor=len(run.graph)-1 # Stop this linear branch.
            elif kind in ('http_request','webhook'):
                if not run.test_mode:
                    safe_url(node['url'])
                    response_code=outbound_post(node['url'],json.dumps(run.context).encode(),headers={'Idempotency-Key':f'{run.id}:{run.cursor}'},timeout=10)
                    if not 200 <= response_code < 300: raise ValueError('Workflow HTTP endpoint failed')
            elif kind=='update_contact':
                Contact.objects.filter(project=run.project,phone=run.context.get('phone')).update(name=str(node.get('name',''))[:120])
            elif kind=='ai_response':
                from .ai import generate
                run.context['suggested_reply']=generate(run.project,str(run.context.get('question','')),node.get('mode','reply'))['response']
            elif kind=='notify_admin':
                AuditLog.objects.create(organization=run.project.organization,action='workflow.notify_admin',target=str(run.id))
            elif kind=='end': run.cursor=len(run.graph)-1
            run.logs.append({'node':run.cursor,'type':kind,'at':timezone.now().isoformat(),'status':'completed'})
            run.cursor+=1
            if kind=='wait' and not run.test_mode:
                run.status='waiting';run.resume_at=timezone.now()+timedelta(seconds=node['seconds']);run.save();return
            run.save()
        run.status='completed';run.save();emit(run.project,'workflow.completed',{'execution_id':str(run.id)})
    except Exception as exc:
        run.status='failed';run.error='Node failed: '+type(exc).__name__;run.save();emit(run.project,'workflow.failed',{'execution_id':str(run.id)})

@shared_task
def retention():
    # Minimize retained content while preserving accounting and idempotency records.
    cutoff=timezone.now()-timedelta(days=90)
    Message.objects.filter(created_at__lt=cutoff).update(payload={})
    AIConversation.objects.filter(created_at__lt=cutoff).delete()
    OTPChallenge.objects.filter(expires_at__lt=timezone.now()-timedelta(days=1)).update(code_hash='')
    Message.objects.filter(otpchallenge__expires_at__lt=timezone.now()).update(payload={})
    WebhookDelivery.objects.filter(created_at__lt=cutoff,status='delivered').delete()


def sync_experimental_receipts():
    if not settings.BAILEYS_ENABLED:return
    from .experimental import connector
    ranks={'accepted':0,'sent':1,'delivered':2,'read':3}
    for connection in WhatsAppConnection.objects.filter(provider='baileys',status='CONNECTED',project__organization__suspended=False):
        try:data=connector(connection,action='/receipts')
        except Exception:continue
        for provider_id,state in data.get('receipts',{}).items():
            if state not in ('sent','delivered','read'):continue
            with transaction.atomic():
                msg=Message.objects.select_for_update().filter(connection=connection,provider_id=provider_id).first()
                if not msg or ranks.get(msg.status,0)>=ranks[state]:continue
                _,fresh=MessageEvent.objects.get_or_create(event_key='baileys:'+str(connection.id)+':'+provider_id+':'+state,defaults={'message':msg,'status':state})
                if fresh:
                    msg.status=state;msg.save(update_fields=['status']);emit(msg.project,'message.'+state,{'message_id':str(msg.id),'experimental':True})
