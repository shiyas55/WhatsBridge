from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
import secrets, uuid
from datetime import timedelta
from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import *
from .serializers import *
from .security import *
from .services import queue_message, emit, graph_validate, EVENTS, phone_number

@extend_schema(parameters=[OpenApiParameter('project',OpenApiTypes.UUID,OpenApiParameter.QUERY,description='Required for browser sessions; inferred from API keys')])
class TenantViewSet(viewsets.ModelViewSet):
    scope=None
    def project(self):
        return project_for(self.request,self.scope,write=self.request.method not in ('GET','HEAD','OPTIONS'))
    def get_queryset(self): return self.queryset.filter(project=self.project()).order_by('-created_at')
    def perform_create(self,serializer): serializer.save(project=self.project())
    def perform_destroy(self,instance):
        audit(self.request,'delete.'+instance.__class__.__name__,instance.project.organization,instance.id);instance.delete()

class ConnectionViewSet(TenantViewSet):
    queryset=WhatsAppConnection.objects.all();serializer_class=ConnectionSerializer;scope='connections:read'
    def project(self):
        if self.request.method not in ('GET','HEAD','OPTIONS'): session_only(self.request)
        return super().project()
    def perform_create(self,serializer):
        project=self.project();provider=serializer.validated_data['provider']
        if (provider=='sandbox') != project.sandbox: raise ValidationError('Use a live project for a real WhatsApp connection')
        if provider=='baileys' and not settings.BAILEYS_ENABLED: raise ValidationError('Experimental QR connector is disabled')
        connection=serializer.save(project=project,status='CONNECTED' if provider=='sandbox' else 'CREATED',last_connected_at=timezone.now() if provider=='sandbox' else None)
        audit(self.request,'connection.create',project.organization,connection.id)
        if provider=='sandbox': emit(project,'connection.connected',{'connection_id':str(connection.id),'simulated':True})
    @action(detail=True,methods=['post'])
    def pair(self,request,pk=None):
        session_only(request);project_for(request,admin=True,write=True)
        connection=self.get_object()
        if connection.provider!='baileys' or connection.status=='REVOKED':raise ValidationError('Create an experimental WhatsApp connection first')
        rate_limit('pair:'+str(connection.id),5,300)
        from .experimental import connector,sync_state
        data=connector(connection,'POST','/pair',{})
        sync_state(connection,data);audit(request,'connection.pair',connection.project.organization,connection.id)
        response=Response(data);response['Cache-Control']='no-store';return response
    @action(detail=True,methods=['get'])
    def qr(self,request,pk=None):
        session_only(request);project_for(request,admin=True)
        connection=self.get_object()
        if connection.provider!='baileys' or connection.status=='REVOKED':raise ValidationError('QR pairing is only available for active experimental connections')
        from .experimental import connector,sync_state
        data=connector(connection);sync_state(connection,data)
        response=Response(data);response['Cache-Control']='no-store';return response
    @action(detail=True,methods=['post'])
    def onboard(self,request,pk=None):
        connection=self.get_object();project_for(request,admin=True,write=True)
        if connection.provider != 'meta': raise ValidationError('Use reconnect for sandbox')
        data=request.data
        if not all(isinstance(data.get(k),str) and data[k] for k in ('access_token','app_secret','verify_token','phone_number_id')): raise ValidationError('Meta access_token, app_secret, verify_token, phone_number_id required')
        if not data['phone_number_id'].isdigit(): raise ValidationError('phone_number_id must be numeric')
        import requests
        try:
            result=requests.post(settings.GATEWAY_URL+'/validate',json={'phone_number_id':data['phone_number_id'],'access_token':data['access_token']},headers={'Authorization':'Bearer '+settings.GATEWAY_TOKEN},timeout=15)
            if result.status_code != 200:
                connection.status='FAILED';connection.error='Meta credential validation failed';connection.save()
                raise ValidationError('Meta could not validate these credentials')
        except requests.RequestException:
            connection.status='FAILED';connection.error='Provider gateway unavailable';connection.save()
            raise ValidationError('Provider gateway unavailable')
        with transaction.atomic():
            ProviderCredential.objects.update_or_create(connection=connection,defaults={'encrypted':encrypt({k:data[k] for k in ('access_token','app_secret','verify_token')})})
            connection.phone_number_id=data['phone_number_id'];connection.status='CONNECTED';connection.last_connected_at=timezone.now();connection.error='';connection.save()
            audit(request,'connection.onboard',connection.project.organization,connection.id)
            emit(connection.project,'connection.connected',{'connection_id':str(connection.id)})
        return Response({'detail':'Credentials validated. Configure Meta webhooks using the documented callback URL.'})
    @action(detail=True,methods=['post'])
    def disconnect(self,request,pk=None):
        connection=self.get_object()
        if connection.provider=='baileys':
            project_for(request,admin=True,write=True)
            from .experimental import connector
            connector(connection,'POST','/disconnect',{})
        connection.status='DISCONNECTED';connection.save()
        ProviderCredential.objects.filter(connection=connection).delete()
        emit(connection.project,'connection.disconnected',{'connection_id':str(connection.id)})
        audit(request,'connection.disconnect',connection.project.organization,connection.id)
        return Response(self.get_serializer(connection).data)
    @action(detail=True,methods=['post'])
    def reconnect(self,request,pk=None):
        connection=self.get_object()
        if connection.provider != 'sandbox': raise ValidationError('Re-onboard Meta credentials to reconnect')
        connection.status='CONNECTED';connection.last_connected_at=timezone.now();connection.save()
        return Response(self.get_serializer(connection).data)
    def perform_destroy(self,instance):
        # Preserve message foreign keys; revoke and erase credentials.
        if instance.provider=='baileys':
            project_for(self.request,admin=True,write=True)
            from .experimental import connector
            connector(instance,'POST','/disconnect',{})
        instance.status='REVOKED';instance.save();ProviderCredential.objects.filter(connection=instance).delete()
        audit(self.request,'connection.revoke',instance.project.organization,instance.id)

class MessageViewSet(TenantViewSet):
    queryset=Message.objects.all();serializer_class=MessageSerializer;http_method_names=['get','post','head','options']
    def project(self): return project_for(self.request,'messages:send' if self.request.method=='POST' else 'messages:read',write=self.request.method=='POST')
    def get_queryset(self):
        qs=super().get_queryset()
        for field in ['status','phone','direction']:
            if self.request.query_params.get(field): qs=qs.filter(**{field:self.request.query_params[field]})
        return qs
    @extend_schema(request=MessageRequestSerializer,responses={202:MessageSerializer,200:MessageSerializer},parameters=[OpenApiParameter('Idempotency-Key',str,OpenApiParameter.HEADER,required=True)])
    def create(self,request,*args,**kwargs):
        data={k:v for k,v in request.data.items() if k in ['connection','phone','kind','payload','scheduled_at']}
        msg,created=queue_message(self.project(),data,request.headers.get('Idempotency-Key',''))
        audit(request,'message.enqueue',msg.project.organization,msg.id)
        return Response(self.get_serializer(msg).data,status=202 if created else 200)

    @action(detail=False, methods=['post'])
    def bulk(self, request):
        project = self.project()
        data = request.data
        conn_id = data.get('connection')
        phones = data.get('phones', [])
        if isinstance(phones, str):
            phones = [p.strip() for p in phones.replace('\n', ',').replace(';', ',').split(',') if p.strip()]
        body = data.get('body', '')
        if not phones:
            raise ValidationError({'phones': 'Provide at least one phone number'})
        if not body:
            raise ValidationError({'body': 'Message body is required'})
        results = []
        base_time = timezone.now()
        for idx, raw_phone in enumerate(phones):
            try:
                clean_phone = phone_number(raw_phone)
            except Exception:
                continue
            key = f"bulk-{uuid.uuid4().hex[:12]}-{idx}"
            scheduled_at = base_time + timedelta(seconds=idx * 5)
            msg, _ = queue_message(
                project,
                {
                    'connection': conn_id,
                    'phone': clean_phone,
                    'kind': 'text',
                    'payload': {'body': body},
                    'scheduled_at': scheduled_at.isoformat()
                },
                key
            )
            results.append({'id': str(msg.id), 'phone': clean_phone, 'status': msg.status, 'scheduled_at': scheduled_at.isoformat()})
        audit(request, 'message.bulk_enqueue', project.organization, len(results))
        return Response({'total': len(results), 'queued': results}, status=202)

class KeyViewSet(TenantViewSet):
    queryset=APIKey.objects.all();serializer_class=APIKeySerializer;http_method_names=['get','post','delete','head','options']
    def project(self):
        session_only(self.request)
        return project_for(self.request,write=self.request.method!='GET',admin=True)
    def create(self,request,*args,**kwargs):
        project=self.project();serializer=self.get_serializer(data=request.data);serializer.is_valid(raise_exception=True)
        secret=('wb_test_' if project.sandbox else 'wb_live_')+secrets.token_urlsafe(32)
        key=serializer.save(project=project,prefix=secret[:16],digest=digest(secret))
        audit(request,'apikey.create',project.organization,key.id)
        return Response({**self.get_serializer(key).data,'secret':secret},status=201)
    def perform_destroy(self,instance):
        instance.revoked_at=timezone.now();instance.save();audit(self.request,'apikey.revoke',instance.project.organization,instance.id)
    @action(detail=True,methods=['post'])
    def rotate(self,request,pk=None):
        key=self.get_object()
        secret=('wb_test_' if key.project.sandbox else 'wb_live_')+secrets.token_urlsafe(32)
        with transaction.atomic():
            self.perform_destroy(key)
            new=APIKey.objects.create(project=key.project,name=key.name,scopes=key.scopes,ip_allowlist=key.ip_allowlist,expires_at=key.expires_at,prefix=secret[:16],digest=digest(secret))
        return Response({**self.get_serializer(new).data,'secret':secret})

class ContactViewSet(TenantViewSet):
    queryset=Contact.objects.all();serializer_class=ContactSerializer
    def project(self): session_only(self.request);return super().project()
    @action(detail=True,methods=['post'])
    def consent(self,request,pk=None):
        contact=self.get_object();purpose=request.data.get('purpose','messaging');basis=request.data.get('basis','')
        if purpose not in ('messaging','otp') or not isinstance(basis,str) or not 1<=len(basis)<=300 or type(request.data.get('granted')) is not bool: raise ValidationError('purpose, boolean granted, and a consent basis are required')
        ContactConsent.objects.create(contact=contact,purpose=purpose,basis=basis,granted=request.data['granted'])
        audit(request,'contact.consent',contact.project.organization,contact.id)
        return Response(self.get_serializer(contact).data)

class WorkflowViewSet(TenantViewSet):
    queryset=Workflow.objects.all();serializer_class=WorkflowSerializer;scope='workflows:manage'
    @action(detail=True,methods=['post'])
    def publish(self,request,pk=None):
        obj=self.get_object()
        with transaction.atomic():
            obj=Workflow.objects.select_for_update().get(pk=obj.pk);graph_validate(obj.graph)
            obj.published_version+=1;obj.status='published';obj.save()
            WorkflowVersion.objects.create(workflow=obj,number=obj.published_version,graph=obj.graph)
        return Response(self.get_serializer(obj).data)
    @action(detail=True,methods=['post'])
    def pause(self,request,pk=None):
        obj=self.get_object();obj.status='paused';obj.save();return Response(self.get_serializer(obj).data)
    @action(detail=True,methods=['post'])
    def resume(self,request,pk=None):
        obj=self.get_object()
        if not obj.published_version: raise ValidationError('Publish a version first')
        obj.status='published';obj.save();return Response(self.get_serializer(obj).data)
    @action(detail=True,methods=['post'])
    def run(self,request,pk=None):
        obj=self.get_object();test=request.data.get('test_mode',False)
        if type(test) is not bool: raise ValidationError('test_mode must be boolean')
        if not test and obj.status!='published': raise ValidationError('Publish or resume the workflow first')
        graph=obj.graph if test else obj.versions.get(number=obj.published_version).graph
        context=request.data.get('context',{})
        if not isinstance(context,dict) or len(str(context))>10000: raise ValidationError('Invalid context')
        run=WorkflowExecution.objects.create(project=obj.project,workflow=obj,version=obj.published_version,graph=graph_validate(graph),context=context,test_mode=test)
        return Response({'id':str(run.id),'status':run.status},status=202)
    @action(detail=True,methods=['post'])
    def retry(self,request,pk=None):
        obj=self.get_object()
        with transaction.atomic():
            run=WorkflowExecution.objects.select_for_update().filter(workflow=obj,id=request.data.get('execution'),status='failed',retries__lt=3).first()
            if not run or run.cursor>=len(run.graph): raise ValidationError('No retryable failed execution')
            if run.graph[run.cursor]['type'] in ('http_request','webhook','ai_response'):
                raise ValidationError('External side effects require manual reconciliation; create a new run after review')
            run.retries+=1;run.status='queued';run.resume_at=timezone.now();run.error='';run.save()
        return Response({'id':str(run.id),'status':'queued','retries':run.retries})
    @action(detail=True,methods=['get'])
    def history(self,request,pk=None):
        obj=self.get_object()
        return Response({'versions' :list(obj.versions.values('number','graph','created_at')),'executions':list(WorkflowExecution.objects.filter(workflow=obj).order_by('-created_at').values('id','status','cursor','logs','error','created_at')[:100])})

class WebhookViewSet(TenantViewSet):
    queryset=WebhookEndpoint.objects.all();serializer_class=WebhookSerializer;scope='webhooks:manage'
    def create(self,request,*args,**kwargs):
        serializer=self.get_serializer(data=request.data);serializer.is_valid(raise_exception=True)
        secret=secrets.token_urlsafe(32);obj=serializer.save(project=self.project(),encrypted_secret=encrypt(secret))
        return Response({**self.get_serializer(obj).data,'secret':secret},status=201)
    @action(detail=True,methods=['post'])
    def rotate(self,request,pk=None):
        obj=self.get_object();secret=secrets.token_urlsafe(32);obj.encrypted_secret=encrypt(secret);obj.save()
        audit(request,'webhook.rotate',obj.project.organization,obj.id);return Response({'secret':secret})
    @action(detail=True,methods=['get'])
    def history(self,request,pk=None):
        obj=self.get_object();return Response(list(obj.deliveries.order_by('-created_at').values('id','event_id','status','attempts','response_code','created_at')[:100]))
    @action(detail=True,methods=['post'])
    def retry(self,request,pk=None):
        obj=self.get_object()
        count=obj.deliveries.filter(id=request.data.get('delivery'),status='dead').update(status='pending',attempts=0,next_attempt_at=timezone.now())
        return Response({'queued':count})

@extend_schema(request=OpenApiTypes.OBJECT,responses=OpenApiTypes.OBJECT)
@api_view(['GET','POST'])
def organizations(request):
    session_only(request)
    if request.method=='GET':
        return Response(list(OrganizationMembership.objects.filter(user=request.user).values('organization_id','organization__name','organization__suspended','role')))
    name=str(request.data.get('name','')).strip()
    if not 1<=len(name)<=120: raise ValidationError('Name must contain 1–120 characters')
    with transaction.atomic():
        org=Organization.objects.create(name=name)
        OrganizationMembership.objects.create(organization=org,user=request.user,role='owner');Subscription.objects.create(organization=org)
    return Response({'id':str(org.id),'name':org.name},status=201)

@extend_schema(request=OpenApiTypes.OBJECT,responses=OpenApiTypes.OBJECT)
@api_view(['GET','POST','PATCH'])
def projects(request):
    session_only(request)
    if request.method=='GET':
        return Response(ProjectSerializer(Project.objects.filter(organization__organizationmembership__user=request.user,organization__suspended=False).order_by('created_at'),many=True).data)
    if request.method=='PATCH':
        project=project_for(request,write=True,admin=True)
        serializer=ProjectSerializer(project,data={k:v for k,v in request.data.items() if k in ['name','ai_enabled','faq']},partial=True)
    else:
        member=OrganizationMembership.objects.filter(organization_id=request.data.get('organization'),user=request.user,organization__suspended=False,role__in=['owner','admin']).first()
        if not member: raise PermissionDenied('Organization administrator required')
        serializer=ProjectSerializer(data={k:v for k,v in request.data.items() if k in ['name','sandbox']})
    serializer.is_valid(raise_exception=True)
    obj=serializer.save(**({'organization':member.organization} if request.method=='POST' else {}))
    audit(request,'project.save',obj.organization,obj.id)
    return Response(ProjectSerializer(obj).data,status=201 if request.method=='POST' else 200)

@extend_schema(request=OpenApiTypes.OBJECT,responses=OpenApiTypes.OBJECT)
@api_view(['GET','POST','DELETE'])
def team(request):
    session_only(request);project=project_for(request,admin=True,write=request.method!='GET')
    if request.method=='GET': return Response(list(OrganizationMembership.objects.filter(organization=project.organization).values('id','user__email','role')))
    if request.method=='DELETE':
        member=OrganizationMembership.objects.filter(pk=request.data.get('membership'),organization=project.organization).exclude(role='owner').first()
        if not member: raise ValidationError('Member cannot be removed')
        member.delete();audit(request,'team.remove',project.organization);return Response(status=204)
    role=request.data.get('role','developer');email=str(request.data.get('email','')).lower()
    from django.core.validators import validate_email
    from django.core.exceptions import ValidationError as DV
    try: validate_email(email)
    except DV: raise ValidationError('Invalid email')
    if role not in ['admin','developer','viewer']: raise ValidationError('Invalid invitation role')
    token=secrets.token_urlsafe(32)
    Invitation.objects.create(organization=project.organization,email=email,role=role,digest=digest(token),expires_at=timezone.now()+timedelta(days=3))
    send_mail('Join WhatsBridge',f'Sign in to accept: {settings.PUBLIC_URL}/?invite={token}',settings.DEFAULT_FROM_EMAIL,[email])
    audit(request,'team.invite',project.organization)
    return Response({'detail':'Invitation sent'},status=201)

@extend_schema(request=OpenApiTypes.OBJECT,responses=OpenApiTypes.OBJECT)
@api_view(['GET'])
def overview(request):
    session_only(request);p=project_for(request)
    return Response({'messages':Message.objects.filter(project=p).count(),'connections':WhatsAppConnection.objects.filter(project=p,status='CONNECTED').count(),'contacts':Contact.objects.filter(project=p).count(),'by_status':list(Message.objects.filter(project=p).values('status').annotate(count=Count('id'))),'usage':list(UsageRecord.objects.filter(project=p).values('kind').annotate(quantity=Sum('quantity'))),'subscription':{'plan':Subscription.objects.get(organization=p.organization).plan,'monthly_limit':p.organization.monthly_limit},'audit':list(AuditLog.objects.filter(organization=p.organization).order_by('-created_at').values('action','target','created_at')[:30])})

@extend_schema(request=OpenApiTypes.OBJECT,responses=OpenApiTypes.OBJECT)
@api_view(['GET','POST'])
def platform(request):
    session_only(request)
    if not request.user.is_superuser: raise PermissionDenied('Platform administrator required')
    if request.method=='POST':
        if request.data.get('key'):
            APIKey.objects.filter(pk=request.data['key']).update(revoked_at=timezone.now());audit(request,'platform.key.disable',target=request.data['key'])
        else:
            org=Organization.objects.get(pk=request.data.get('organization'))
            if 'suspended' in request.data:
                if type(request.data['suspended']) is not bool: raise ValidationError('suspended must be boolean')
                org.suspended=request.data['suspended']
            if 'monthly_limit' in request.data:
                limit=request.data['monthly_limit']
                if type(limit) is not int or not 0<=limit<=10000000: raise ValidationError('Invalid monthly limit')
                org.monthly_limit=limit
            org.save();audit(request,'platform.organization.update',org,org.id)
        return Response({'detail':'Updated'})
    from django.core.cache import cache
    return Response({'worker_last_dispatch':cache.get('worker:last_dispatch'),'organizations':list(Organization.objects.values('id','name','suspended','monthly_limit')),'users':User.objects.filter(is_active=True).count(),'projects':Project.objects.count(),'connections':WhatsAppConnection.objects.filter(status='CONNECTED').count(),'failures':Message.objects.filter(status__in=['failed','unknown']).count(),'queue':Message.objects.filter(status='queued').count(),'webhook_dead_letters':WebhookDelivery.objects.filter(status='dead').count()})

class TemplateViewSet(TenantViewSet):
    queryset=MessageTemplate.objects.all();serializer_class=TemplateSerializer
    def project(self): session_only(self.request);return super().project()
