import hashlib, json, re, secrets, uuid
from datetime import timedelta
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import *
from .security import encrypt, decrypt, safe_url

PHONE = re.compile(r'^\+[1-9][0-9]{7,14}$')
KINDS = {'text','image','document','video','audio','template'}
EVENTS = {'message.received','message.sent','message.delivered','message.read','message.failed','connection.connected','connection.disconnected','otp.verified','workflow.completed','workflow.failed'}

def phone_number(phone):
    if not isinstance(phone,str) or not PHONE.fullmatch(phone): raise ValidationError({'phone':'Use E.164 format, e.g. +15551234567'})
    return phone

def emit(project, event, data):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    event_id = uuid.uuid4()
    payload = {'id':str(event_id),'type':event,'created_at':timezone.now().isoformat(),'data':data}
    for endpoint in WebhookEndpoint.objects.filter(project=project,enabled=True):
        if event in endpoint.events:
            WebhookDelivery.objects.get_or_create(endpoint=endpoint,event_id=event_id,defaults={'payload':payload})
    # Notifications carry identifiers/status only, never private message contents.
    def notify():
        try: async_to_sync(get_channel_layer().group_send)('project.'+str(project.id),{'type':'event','payload':payload})
        except Exception: pass # Durable webhook outbox remains authoritative.
    transaction.on_commit(notify)

def consent_for(project, phone, purpose='messaging'):
    return ContactConsent.objects.filter(contact__project=project,contact__phone=phone,purpose=purpose).order_by('-created_at').first()

def validate_payload(kind, payload):
    if kind not in KINDS or not isinstance(payload,dict): raise ValidationError('Unsupported message type or payload')
    if kind == 'text':
        if not isinstance(payload.get('body'),str) or not 1 <= len(payload['body']) <= 4096: raise ValidationError('Text body must contain 1–4096 characters')
    elif kind == 'template':
        if not re.fullmatch(r'[a-z0-9_]{1,512}',str(payload.get('name',''))) or not re.fullmatch(r'[a-zA-Z_]{2,12}',str(payload.get('language',''))): raise ValidationError('Template name and language are required')
        if not isinstance(payload.get('components',[]),list): raise ValidationError('Template components must be a list')
    else:
        from urllib.parse import urlparse
        url = urlparse(str(payload.get('link','')))
        if url.scheme != 'https' or not url.hostname or url.username: raise ValidationError('Media requires an HTTPS link')
    if len(json.dumps(payload)) > 20000: raise ValidationError('Payload too large')

@transaction.atomic
def queue_message(project, data, key, otp=False):
    if not isinstance(key,str) or not 1 <= len(key) <= 128: raise ValidationError('Idempotency-Key header is required (max 128 characters)')
    # Organization row serializes quota reservations and idempotent requests.
    org = Organization.objects.select_for_update().get(pk=project.organization_id)
    if org.suspended: raise PermissionDenied('Organization suspended')
    canonical = json.dumps(data,sort_keys=True,default=str,separators=(',',':'))
    request_digest = hashlib.sha256(canonical.encode()).hexdigest()
    existing = Message.objects.filter(project=project,idempotency_key=key).first()
    if existing:
        if existing.request_digest != request_digest: raise ValidationError('Idempotency key reused with different request data')
        return existing, False
    try: connection = WhatsAppConnection.objects.get(pk=data.get('connection'),project=project,status='CONNECTED')
    except (WhatsAppConnection.DoesNotExist,ValueError): raise ValidationError('Connected transport in this project required')
    if connection.provider=='baileys':
        from django.conf import settings
        if not settings.BAILEYS_ENABLED or (otp and not settings.BAILEYS_OTP_ENABLED) or data.get('kind','text')!='text': raise ValidationError('WhatsApp Web connector supports text only')
    phone = phone_number(data.get('phone'))
    consent = consent_for(project,phone,'otp' if otp else 'messaging')
    if not consent:
        contact, _ = Contact.objects.get_or_create(project=project, phone=phone, defaults={'name': phone})
        consent = ContactConsent.objects.create(contact=contact, purpose='otp' if otp else 'messaging', basis='Dashboard direct send', granted=True)
    elif not consent.granted:
        raise ValidationError('Recipient consent required before sending')
    kind = data.get('kind','text'); payload = data.get('payload',{})
    validate_payload(kind,payload)
    if connection.provider == 'meta' and kind != 'template':
        last_inbound = Message.objects.filter(project=project,connection=connection,phone=phone,direction='inbound',created_at__gte=timezone.now()-timedelta(hours=24)).exists()
        if not last_inbound: raise ValidationError('Outside the customer service window: use an approved template')
    start = timezone.now().replace(day=1,hour=0,minute=0,second=0,microsecond=0)
    usage = UsageRecord.objects.filter(project__organization=org,kind='message_reserved',created_at__gte=start).aggregate(n=Sum('quantity'))['n'] or 0
    if usage >= org.monthly_limit: raise PermissionDenied('Organization monthly message limit reached')
    scheduled = data.get('scheduled_at') or timezone.now()
    if isinstance(scheduled,str):
        from django.utils.dateparse import parse_datetime
        scheduled = parse_datetime(scheduled)
        if not scheduled or timezone.is_naive(scheduled): raise ValidationError('scheduled_at must include a timezone')
    msg = Message.objects.create(project=project,connection=connection,phone=phone,kind=kind,payload={'encrypted_otp':encrypt(payload)} if otp else payload,idempotency_key=key,request_digest=request_digest,scheduled_at=scheduled)
    UsageRecord.objects.create(project=project,kind='message_reserved',reference='reserve:'+str(msg.id))
    if scheduled <= timezone.now():
        def dispatch():
            try:
                from .tasks import send_message
                send_message.delay(str(msg.id))
            except Exception:
                try:
                    from .tasks import send_message
                    send_message(str(msg.id))
                except Exception:
                    pass
        transaction.on_commit(dispatch)
    return msg, True

def graph_validate(graph):
    if not isinstance(graph,list) or not 1 <= len(graph) <= 50: raise ValidationError('Workflow requires 1–50 ordered nodes')
    supported = {'trigger','send_message','wait','condition','http_request','webhook','ai_response','update_contact','notify_admin','end'}
    for i,node in enumerate(graph):
        if not isinstance(node,dict) or node.get('type') not in supported: raise ValidationError('Unsupported workflow node')
        if node['type'] == 'wait':
            if type(node.get('seconds')) is not int or not 0 <= node['seconds'] <= 604800: raise ValidationError('Wait must be 0–604800 seconds')
        if node['type'] in ('http_request','webhook'): safe_url(node.get('url',''))
        if node['type'] == 'condition' and not isinstance(node.get('field'),str): raise ValidationError('Condition needs a context field')
    if len(json.dumps(graph)) > 100000: raise ValidationError('Workflow is too large')
    return graph
