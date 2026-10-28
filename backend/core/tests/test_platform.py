import json, hashlib, hmac, uuid
from datetime import timedelta
from unittest.mock import patch, Mock
import pytest
from django.core.cache import cache
from django.utils import timezone
from django.core import mail, signing
from django.contrib.auth.hashers import check_password
from rest_framework.test import APIClient
from core.models import *
from core.security import digest, encrypt, decrypt, sign_webhook, verify_webhook, safe_url
from core.services import queue_message, emit
from core.tasks import send_message, deliver_webhook, run_workflow, retention

pytestmark=pytest.mark.django_db
@pytest.fixture(autouse=True)
def clear_cache(): cache.clear()
@pytest.fixture
def env():
    user=User.objects.create_user(username='owner@example.com',email='owner@example.com',password='correct-passphrase-123',email_verified=True)
    org=Organization.objects.create(name='Acme');OrganizationMembership.objects.create(organization=org,user=user,role='owner');Subscription.objects.create(organization=org)
    project=Project.objects.create(organization=org,name='Sandbox')
    connection=WhatsAppConnection.objects.create(project=project,name='Test',provider='sandbox',status='CONNECTED')
    contact=Contact.objects.create(project=project,phone='+15551234567',name='Recipient')
    for purpose in ['messaging','otp']:ContactConsent.objects.create(contact=contact,purpose=purpose,basis='User requested test')
    client=APIClient();client.force_login(user)
    return client,user,org,project,connection,contact

def send_data(connection):return {'connection':str(connection.id),'phone':'+15551234567','kind':'text','payload':{'body':'Hello'}}
def key_client(project,scopes):
    token='wb_test_secret_'+str(uuid.uuid4());key=APIKey.objects.create(project=project,name='Test',prefix=token[:16],digest=digest(token),scopes=scopes)
    client=APIClient();client.credentials(HTTP_AUTHORIZATION='Bearer '+token);return client,key

def test_encryption_round_trip():
    encrypted=encrypt({'secret':'private'});assert 'private' not in encrypted;assert decrypt(encrypted)=={'secret':'private'}

def test_register_verify_login(settings):
    settings.EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'
    client=APIClient(enforce_csrf_checks=True)
    session=client.get('/api/auth/session').json();headers={'HTTP_X_CSRFTOKEN':session['csrfToken']}
    response=client.post('/api/auth/register',{'email':'new@example.com','password':'a-long-passphrase-321','organization':'New'},format='json',**headers)
    assert response.status_code==201
    assert client.post('/api/auth/login',{'email':'new@example.com','password':'a-long-passphrase-321'},format='json',**headers).status_code==403
    token=mail.outbox[-1].body.split('?verify=')[1]
    assert client.post('/api/auth/verify-email',{'token':token},format='json',**headers).status_code==200
    assert client.post('/api/auth/login',{'email':'new@example.com','password':'a-long-passphrase-321'},format='json',**headers).status_code==200
    assert client.get('/api/auth/session').json()['user']['email']=='new@example.com'

def test_login_csrf_required():
    client=APIClient(enforce_csrf_checks=True)
    assert client.post('/api/auth/login',{'email':'a@b.com','password':'test'},format='json').status_code==403

def test_password_reset(env,settings):
    settings.EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'
    client,user,*_=env
    assert client.post('/api/auth/forgot-password',{'email':user.email},format='json').status_code==200
    token=mail.outbox[-1].body.split('?reset=')[1].split('&uid=')[0]
    data={'uid':user.pk,'token':token,'password':'replacement-password-123'}
    assert client.post('/api/auth/reset-password',data,format='json').status_code==200
    assert client.post('/api/auth/reset-password',data,format='json').status_code==400

def test_tenant_list_and_object_isolation(env):
    client,user,org,p,c,_=env
    other_org=Organization.objects.create(name='Other');other=Project.objects.create(organization=other_org,name='Private')
    foreign=WhatsAppConnection.objects.create(project=other,name='Secret',provider='sandbox')
    assert client.get('/api/v1/connections',{'project':other.id}).status_code==403
    assert client.get(f'/api/v1/connections/{foreign.id}',{'project':p.id}).status_code==404
    assert client.patch(f'/api/v1/connections/{foreign.id}?project={p.id}',{'name':'attack'},format='json').status_code==404

def test_cross_tenant_connection_send_forbidden(env):
    client,_,_,p,c,_=env
    other=Project.objects.create(organization=Organization.objects.create(name='Other'),name='Other')
    c.project=other;c.save()
    response=client.post('/api/v1/messages?project='+str(p.id),send_data(c),format='json',HTTP_IDEMPOTENCY_KEY='attack')
    assert response.status_code==400;assert Message.objects.count()==0

def test_viewer_cannot_write_or_mint_keys(env):
    client,user,org,p,c,_=env
    OrganizationMembership.objects.filter(user=user).update(role='viewer')
    assert client.get('/api/v1/connections',{'project':p.id}).status_code==200
    assert client.post('/api/v1/messages?project='+str(p.id),send_data(c),format='json',HTTP_IDEMPOTENCY_KEY='viewer').status_code==403
    assert client.get('/api/v1/keys',{'project':p.id}).status_code==403

def test_key_scopes_revocation_expiry_and_project(env):
    _,_,_,p,c,_=env
    client,key=key_client(p,['messages:read'])
    assert client.get('/api/v1/messages').status_code==200
    assert client.post('/api/v1/messages',send_data(c),format='json',HTTP_IDEMPOTENCY_KEY='test').status_code==403
    assert client.get('/api/projects').status_code==403
    assert client.get('/api/v1/messages?project='+str(uuid.uuid4())).status_code==403
    key.revoked_at=timezone.now();key.save();assert client.get('/api/v1/messages').status_code==401
    key.revoked_at=None;key.expires_at=timezone.now()-timedelta(seconds=1);key.save();assert client.get('/api/v1/messages').status_code==401

def test_key_secret_only_once(env):
    client,_,_,p,_,_=env
    r=client.post('/api/v1/keys?project='+str(p.id),{'name':'Server','scopes':['messages:send']},format='json')
    assert r.status_code==201
    key=APIKey.objects.get(pk=r.data['id']);assert key.digest==digest(r.data['secret'])
    listing=client.get('/api/v1/keys',{'project':p.id}).json()['results'][0]
    assert 'secret' not in listing and 'digest' not in listing

def test_key_ip_allowlist(env):
    *_,p,c,contact=env
    client,key=key_client(p,['messages:read']);key.ip_allowlist=['203.0.113.1'];key.save()
    assert client.get('/api/v1/messages').status_code==401

def test_suspended_org_blocks_keys_and_sessions(env):
    client,_,org,p,_,_=env;kc,key=key_client(p,['messages:read']);org.suspended=True;org.save()
    assert client.get('/api/v1/messages',{'project':p.id}).status_code==403
    assert kc.get('/api/v1/messages').status_code==401

def test_idempotency_and_billing_reservation(env):
    _,_,_,p,c,_=env
    a,new=queue_message(p,send_data(c),'same');b,new2=queue_message(p,send_data(c),'same')
    assert a.id==b.id and new and not new2
    assert UsageRecord.objects.filter(kind='message_reserved').count()==1
    with pytest.raises(Exception):queue_message(p,{**send_data(c),'payload':{'body':'Changed'}},'same')

def test_consent_required_and_revocation_before_send(env):
    _,_,_,p,c,contact=env
    msg,_=queue_message(p,send_data(c),'consent')
    ContactConsent.objects.create(contact=contact,purpose='messaging',basis='Opt out',granted=False)
    with patch('core.tasks.requests.post') as post:send_message(str(msg.id));post.assert_not_called()
    msg.refresh_from_db();assert msg.status=='failed'
    with pytest.raises(Exception):queue_message(p,send_data(c),'revoked')

def test_quota_blocks_over_limit(env):
    _,_,org,p,c,_=env;org.monthly_limit=1;org.save()
    queue_message(p,send_data(c),'one')
    with pytest.raises(Exception):queue_message(p,send_data(c),'two')

def test_queue_sandbox_and_duplicate_worker(env):
    _,_,_,p,c,_=env;msg,_=queue_message(p,send_data(c),'queue')
    response=Mock(status_code=200);response.json.return_value={'status':'accepted','provider_id':'sandbox_test'}
    with patch('core.tasks.requests.post',return_value=response) as post:send_message(str(msg.id));send_message(str(msg.id));assert post.call_count==1
    msg.refresh_from_db();assert msg.status=='delivered';assert msg.events.count()==2
    assert UsageRecord.objects.filter(kind='message_accepted').count()==1

def test_unknown_outcome_is_not_retried(env):
    import requests
    _,_,_,p,c,_=env;msg,_=queue_message(p,send_data(c),'unknown')
    with patch('core.tasks.requests.post',side_effect=requests.Timeout) as post:send_message(str(msg.id));send_message(str(msg.id));assert post.call_count==1
    msg.refresh_from_db();assert msg.status=='unknown'

def test_retry_and_dead_letter(env):
    _,_,_,p,c,_=env;msg,_=queue_message(p,send_data(c),'retry')
    response=Mock(status_code=429);response.json.return_value={'safe_to_retry':True}
    with patch('core.tasks.requests.post',return_value=response):
        for _ in range(5):
            Message.objects.filter(pk=msg.pk).update(scheduled_at=timezone.now());send_message(str(msg.id))
    msg.refresh_from_db();assert msg.status=='failed' and msg.attempts==5

def test_scheduled_message_waits(env):
    _,_,_,p,c,_=env;msg,_=queue_message(p,{**send_data(c),'scheduled_at':timezone.now()+timedelta(hours=1)},'scheduled')
    with patch('core.tasks.requests.post') as post:send_message(str(msg.id));post.assert_not_called()

def test_connection_lifecycle(env):
    client,_,_,p,c,_=env
    assert client.post(f'/api/v1/connections/{c.id}/disconnect?project={p.id}',{},format='json').status_code==200
    c.refresh_from_db();assert c.status=='DISCONNECTED'
    assert client.post(f'/api/v1/connections/{c.id}/reconnect?project={p.id}',{},format='json').status_code==200
    assert client.delete(f'/api/v1/connections/{c.id}?project={p.id}').status_code==204
    c.refresh_from_db();assert c.status=='REVOKED'

def otp_send(env):
    client,_,_,p,c,_=env
    return client.post('/api/v1/otp/send?project='+str(p.id),{'connection':str(c.id),'phone':'+15551234567'},format='json')

def test_otp_hash_redaction_single_use(env):
    client,_,_,p,_,_=env;r=otp_send(env);assert r.status_code==202,r.data
    challenge=OTPChallenge.objects.get(pk=r.data['challenge_id']);code=r.data['sandbox_code']
    assert challenge.code_hash!=code and check_password(code,challenge.code_hash)
    msg=client.get(f'/api/v1/messages/{challenge.message_id}?project={p.id}').json()
    assert msg['payload']=={'redacted':True}
    data={'challenge_id':str(challenge.id),'code':code}
    assert client.post('/api/v1/otp/verify?project='+str(p.id),data,format='json').status_code==200
    assert client.post('/api/v1/otp/verify?project='+str(p.id),data,format='json').status_code==400

def test_otp_expiration_attempt_limit_and_cooldown(env):
    client,_,_,p,_,_=env;r=otp_send(env);assert otp_send(env).status_code==429
    challenge=OTPChallenge.objects.get(pk=r.data['challenge_id'])
    wrong='000000' if r.data['sandbox_code']!='000000' else '111111'
    for _ in range(5):assert client.post('/api/v1/otp/verify?project='+str(p.id),{'challenge_id':str(challenge.id),'code':wrong},format='json').status_code==400
    challenge.refresh_from_db();assert challenge.attempts==5
    assert client.post('/api/v1/otp/verify?project='+str(p.id),{'challenge_id':str(challenge.id),'code':r.data['sandbox_code']},format='json').status_code==400
    challenge.attempts=0;challenge.expires_at=timezone.now()-timedelta(seconds=1);challenge.save()
    assert client.post('/api/v1/otp/verify?project='+str(p.id),{'challenge_id':str(challenge.id),'code':r.data['sandbox_code']},format='json').status_code==400

def test_otp_cross_project_verify(env):
    client,_,org,p,_,_=env;r=otp_send(env)
    other=Project.objects.create(organization=org,name='Other')
    assert client.post('/api/v1/otp/verify?project='+str(other.id),{'challenge_id':r.data['challenge_id'],'code':r.data['sandbox_code']},format='json').status_code==400

def test_workflow_publish_run_and_snapshot(env):
    client,_,_,p,c,_=env
    graph=[{'type':'trigger'},{'type':'send_message','connection':str(c.id),'payload':{'body':'Workflow'}},{'type':'end'}]
    flow=Workflow.objects.create(project=p,name='Test',graph=graph)
    assert client.post(f'/api/v1/workflows/{flow.id}/publish?project={p.id}',{},format='json').status_code==200
    flow.graph=[{'type':'end'}];flow.save(update_fields=['graph'])
    r=client.post(f'/api/v1/workflows/{flow.id}/run?project={p.id}',{'context':{'phone':'+15551234567'}},format='json')
    assert r.status_code==202;run_workflow(r.data['id']);run=WorkflowExecution.objects.get(pk=r.data['id'])
    assert run.status=='completed' and len(run.logs)==3;assert Message.objects.count()==1
    run_workflow(str(run.id));assert Message.objects.count()==1

def test_workflow_wait_and_pause(env):
    _,_,_,p,_,_=env
    flow=Workflow.objects.create(project=p,name='Wait',status='published',graph=[])
    run=WorkflowExecution.objects.create(project=p,workflow=flow,graph=[{'type':'wait','seconds':10},{'type':'end'}])
    run_workflow(str(run.id));run.refresh_from_db();assert run.status=='waiting' and run.cursor==1
    flow.status='paused';flow.save();run.resume_at=timezone.now();run.save()
    run_workflow(str(run.id));run.refresh_from_db();assert run.status=='waiting'

def test_webhook_signature_timestamp_and_tamper():
    signature=sign_webhook('secret','1000',b'body')
    assert verify_webhook('secret','1000',b'body',signature,now=1001)
    assert not verify_webhook('secret','1000',b'body',signature,now=2000)
    assert not verify_webhook('secret','1000',b'changed',signature,now=1001)

def test_webhook_delivery_signature_and_history(env,settings):
    _,_,_,p,_,_=env;settings.WEBHOOK_ALLOWED_HOSTS=['hooks.example.com']
    endpoint=WebhookEndpoint.objects.create(project=p,url='https://hooks.example.com/event',events=['message.sent'],encrypted_secret=encrypt('secret'))
    emit(p,'message.sent',{'message_id':'test'});delivery=WebhookDelivery.objects.get(endpoint=endpoint)
    with patch('core.security.socket.getaddrinfo',return_value=[(2,1,6,'',('8.8.8.8',443))]),patch('core.tasks.outbound_post',return_value=200) as post:
        deliver_webhook(str(delivery.id));kwargs=post.call_args.kwargs;body=post.call_args.args[1]
        assert verify_webhook('secret',kwargs['headers']['X-WhatsBridge-Timestamp'],body,kwargs['headers']['X-WhatsBridge-Signature'])
    delivery.refresh_from_db();assert delivery.status=='delivered'

def test_ssrf_rejects_private_hosts_and_userinfo(settings):
    settings.WEBHOOK_ALLOWED_HOSTS=['localhost','allowed.example.com']
    for url in ['http://allowed.example.com','https://user:pass@allowed.example.com','https://evil.example.com','https://allowed.example.com:8443']:
        with pytest.raises(Exception):safe_url(url)
    with patch('core.security.socket.getaddrinfo',return_value=[(2,1,6,'',('127.0.0.1',443))]):
        with pytest.raises(Exception):safe_url('https://allowed.example.com')

def test_meta_signature_and_event_deduplication(env):
    client,_,_,p,c,_=env;c.provider='meta';c.phone_number_id='123';c.save()
    ProviderCredential.objects.create(connection=c,encrypted=encrypt({'app_secret':'meta-secret','verify_token':'verify','access_token':'token'}))
    msg=Message.objects.create(project=p,connection=c,phone='+15551234567',idempotency_key='meta',request_digest='',status='accepted',provider_id='wamid.1')
    body=json.dumps({'entry':[{'changes':[{'value':{'metadata':{'phone_number_id':'123'},'statuses':[{'id':'wamid.1','status':'delivered'}]}}]}]}).encode()
    path=f'/api/providers/meta/{c.id}'
    assert client.post(path,body,content_type='application/json').status_code==403
    sig='sha256='+hmac.new(b'meta-secret',body,hashlib.sha256).hexdigest()
    for _ in range(2):assert client.post(path,body,content_type='application/json',HTTP_X_HUB_SIGNATURE_256=sig).status_code==200
    msg.refresh_from_db();assert msg.status=='delivered';assert msg.events.count()==1
    assert client.get(path,{'hub.mode':'subscribe','hub.verify_token':'verify','hub.challenge':'42'}).content==b'42'

def test_production_otp_requires_vetted_template(env):
    client,_,_,p,c,_=env;p.sandbox=False;p.save();c.provider='meta';c.save()
    assert otp_send(env).status_code==400

def test_api_rate_limit(env):
    _,_,_,p,_,_=env;client,key=key_client(p,['messages:read'])
    for _ in range(120):assert client.get('/api/v1/messages').status_code==200
    assert client.get('/api/v1/messages').status_code==429

def test_admin_is_not_customer_access(env):
    client,*_=env;assert client.get('/api/platform').status_code==403

def test_retention_removes_payload_but_preserves_accounting(env):
    _,_,_,p,c,_=env;msg,_=queue_message(p,send_data(c),'retention')
    Message.objects.filter(pk=msg.id).update(created_at=timezone.now()-timedelta(days=91))
    retention();msg.refresh_from_db();assert msg.payload=={};assert UsageRecord.objects.count()==1

def test_experimental_qr_requires_session_admin(env,settings):
    settings.BAILEYS_ENABLED=True;settings.BAILEYS_TOKEN='private-test-token'
    client,user,org,p,c,_=env;p.sandbox=False;p.save();c.provider='baileys';c.status='CREATED';c.save()
    response=Mock(status_code=200,ok=True);response.json.return_value={'status':'PAIRING'}
    with patch('core.experimental.requests.request',return_value=response):
        r=client.post(f'/api/v1/connections/{c.id}/pair?project={p.id}',{},format='json');assert r.status_code==200;assert r['Cache-Control']=='no-store'
    key,_=key_client(p,['connections:read']);assert key.get(f'/api/v1/connections/{c.id}/qr').status_code==403
    OrganizationMembership.objects.filter(user=user).update(role='viewer')
    assert client.get(f'/api/v1/connections/{c.id}/qr?project={p.id}').status_code==403

def test_experimental_otp_forbidden(env,settings):
    settings.BAILEYS_ENABLED=True
    client,_,_,p,c,_=env;p.sandbox=False;p.save();c.provider='baileys';c.status='CONNECTED';c.save()
    assert otp_send(env).status_code==400
    assert OTPChallenge.objects.count()==0
    with pytest.raises(Exception):queue_message(p,send_data(c),'experimental-otp',otp=True)

def test_experimental_transport_is_opt_in_and_text_only(env,settings):
    _,_,_,p,c,_=env;p.sandbox=False;p.save();c.provider='baileys';c.save()
    settings.BAILEYS_ENABLED=False
    with pytest.raises(Exception):queue_message(p,send_data(c),'disabled')
    settings.BAILEYS_ENABLED=True
    with pytest.raises(Exception):queue_message(p,{**send_data(c),'kind':'template','payload':{'name':'hello','language':'en_US'}},'template')
    msg,_=queue_message(p,send_data(c),'allowed');assert msg.status=='queued'

def test_experimental_send_uses_isolated_gateway(env,settings):
    settings.BAILEYS_ENABLED=True;settings.BAILEYS_TOKEN='private-test-token';settings.BAILEYS_URL='http://isolated:14001'
    _,_,org,p,c,_=env;p.sandbox=False;p.save();c.provider='baileys';c.save()
    msg,_=queue_message(p,send_data(c),'isolated')
    response=Mock(status_code=200);response.json.return_value={'status':'accepted','provider_id':'real-provider-id'}
    with patch('core.tasks.requests.post',return_value=response) as post:
        send_message(str(msg.id));assert post.call_args.args[0]==f'http://isolated:14001/sessions/{org.id}/{p.id}/{c.id}/send'
    msg.refresh_from_db();assert msg.status=='accepted';assert msg.events.count()==0

def test_qr_does_not_cross_tenants(env,settings):
    client,_,_,p,c,_=env
    foreign=Project.objects.create(organization=Organization.objects.create(name='Other'),name='Other')
    c.project=foreign;c.provider='baileys';c.save()
    with patch('core.experimental.requests.request') as post:
        assert client.get(f'/api/v1/connections/{c.id}/qr?project={p.id}').status_code==404
        post.assert_not_called()

def test_new_user_to_project_key_and_qr_flow(settings):
    settings.EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'
    settings.BAILEYS_ENABLED=True;settings.BAILEYS_TOKEN='test-private-token'
    client=APIClient(enforce_csrf_checks=True)
    def headers():return {'HTTP_X_CSRFTOKEN':client.get('/api/auth/session').json()['csrfToken']}
    credentials={'email':'onboarding@example.com','password':'onboarding-test-passphrase-123'}
    assert client.post('/api/auth/register',{**credentials,'organization':'New tenant'},format='json',**headers()).status_code==201
    token=mail.outbox[-1].body.split('?verify=')[1]
    assert client.post('/api/auth/verify-email',{'token':token},format='json',**headers()).status_code==200
    assert client.post('/api/auth/login',credentials,format='json',**headers()).status_code==200
    org=client.get('/api/organizations').json()[0]['organization_id']
    project=client.post('/api/projects',{'organization':org,'name':'Live','sandbox':False},format='json',**headers()).json()
    query='?project='+project['id']
    connection=client.post('/api/v1/connections'+query,{'name':'Phone','provider':'baileys'},format='json',**headers())
    assert connection.status_code==201
    path='/api/v1/connections/'+connection.json()['id']
    response=Mock(ok=True,status_code=200);response.json.return_value={'status':'PAIRING','qr':'data:image/png;base64,test'}
    with patch('core.experimental.requests.request',return_value=response):
        assert client.post(path+'/pair'+query,{},format='json',**headers()).status_code==200
        assert client.get(path+'/qr'+query).json()['qr'].startswith('data:image/png')
    key=client.post('/api/v1/keys'+query,{'name':'Application','scopes':['messages:send','messages:read','connections:read']},format='json',**headers())
    assert key.status_code==201
    app=APIClient();app.credentials(HTTP_AUTHORIZATION='Bearer '+key.json()['secret'])
    assert app.get(path+'/qr').status_code==403
    assert app.post('/api/v1/messages',{'connection':connection.json()['id'],'phone':'+15551234567','kind':'text','payload':{'body':'Hello'}},format='json',HTTP_IDEMPOTENCY_KEY='unlinked').status_code==400

def test_live_qr_creation_is_opt_in_and_not_sandbox(env,settings):
    client,_,_,project,_,_=env
    settings.BAILEYS_ENABLED=True
    assert client.post('/api/v1/connections?project='+str(project.id),{'name':'Phone','provider':'baileys'},format='json').status_code==400
    project.sandbox=False;project.save();settings.BAILEYS_ENABLED=False
    assert client.post('/api/v1/connections?project='+str(project.id),{'name':'Phone','provider':'baileys'},format='json').status_code==400

def test_opt_in_qr_otp_send_verify_and_replay(env,settings):
    settings.BAILEYS_ENABLED=True;settings.BAILEYS_OTP_ENABLED=True;settings.BAILEYS_TOKEN='private-test-token'
    client,_,_,p,c,_=env;p.sandbox=False;p.save();c.provider='baileys';c.save()
    with patch('core.otp.secrets.randbelow',return_value=582914):r=otp_send(env)
    assert r.status_code==202 and r.data['experimental'] and not r.data['delivery_guaranteed']
    assert 'sandbox_code' not in r.data
    challenge=OTPChallenge.objects.get(pk=r.data['challenge_id'])
    assert check_password('582914',challenge.code_hash)
    assert 295 < (challenge.expires_at-timezone.now()).total_seconds() <= 300
    assert '582914' not in json.dumps(challenge.message.payload)
    response=Mock(status_code=200);response.json.return_value={'status':'accepted','provider_id':'otp-provider-id'}
    with patch('core.tasks.requests.post',return_value=response) as send:
        send_message(str(challenge.message_id))
        assert send.call_args.kwargs['json']['payload']['body'].startswith('Your verification code is 582914')
    data={'challenge_id':str(challenge.id),'code':'582914'}
    verified=client.post('/api/v1/otp/verify?project='+str(p.id),data,format='json')
    assert verified.status_code==200
    proof=signing.loads(verified.data['verification_token'],salt='whatsbridge-phone-verification-v1',max_age=300)
    assert proof['project']==str(p.id) and proof['purpose']=='phone_verification'
    assert client.post('/api/v1/otp/verify?project='+str(p.id),data,format='json').status_code==400

def test_disable_experimental_otp_before_dispatch(env,settings):
    settings.BAILEYS_ENABLED=True;settings.BAILEYS_OTP_ENABLED=True
    _,_,_,p,c,_=env;p.sandbox=False;p.save();c.provider='baileys';c.save()
    r=otp_send(env);assert r.status_code==202
    challenge=OTPChallenge.objects.get(pk=r.data['challenge_id'])
    settings.BAILEYS_OTP_ENABLED=False
    with patch('core.tasks.requests.post') as send:
        send_message(str(challenge.message_id));send.assert_not_called()
    challenge.message.refresh_from_db();assert challenge.message.status=='failed'
