import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone

class User(AbstractUser):
    email = models.EmailField(unique=True)
    email_verified = models.BooleanField(default=False)
    totp_secret = models.TextField(blank=True)
    totp_enabled = models.BooleanField(default=False)
    last_totp_step = models.BigIntegerField(default=-1)

class Record(models.Model):
    id = models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    created_at = models.DateTimeField(default=timezone.now,db_index=True)
    class Meta: abstract = True

class Organization(Record):
    name = models.CharField(max_length=120)
    suspended = models.BooleanField(default=False)
    monthly_limit = models.PositiveIntegerField(default=10000)

class OrganizationMembership(Record):
    ROLES = [('owner','Owner'),('admin','Admin'),('developer','Developer'),('viewer','Support / Viewer')]
    organization = models.ForeignKey(Organization,on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    role = models.CharField(max_length=20,choices=ROLES,default='developer')
    class Meta: constraints = [models.UniqueConstraint(fields=['organization','user'],name='one_membership')]

class Invitation(Record):
    organization = models.ForeignKey(Organization,on_delete=models.CASCADE)
    email = models.EmailField()
    role = models.CharField(max_length=20,choices=OrganizationMembership.ROLES,default='developer')
    digest = models.CharField(max_length=64,unique=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True)

class Project(Record):
    organization = models.ForeignKey(Organization,on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    sandbox = models.BooleanField(default=True)
    ai_enabled = models.BooleanField(default=False)
    ai_token_limit = models.PositiveIntegerField(default=10000)
    faq = models.TextField(blank=True)

class ProjectRecord(Record):
    project = models.ForeignKey(Project,on_delete=models.CASCADE)
    class Meta: abstract = True

class WhatsAppConnection(ProjectRecord):
    name = models.CharField(max_length=120)
    provider = models.CharField(max_length=20,choices=[('sandbox','Sandbox'),('meta','Official Meta'),('baileys','Experimental WhatsApp Web')])
    status = models.CharField(max_length=20,default='CREATED')
    phone_number_id = models.CharField(max_length=80,blank=True)
    last_connected_at = models.DateTimeField(null=True)
    error = models.CharField(max_length=250,blank=True)

class ProviderCredential(Record):
    connection = models.OneToOneField(WhatsAppConnection,on_delete=models.CASCADE,related_name='credential')
    encrypted = models.TextField()

class APIKey(ProjectRecord):
    name = models.CharField(max_length=120)
    prefix = models.CharField(max_length=24)
    digest = models.CharField(max_length=64,unique=True)
    scopes = models.JSONField(default=list)
    ip_allowlist = models.JSONField(default=list)
    expires_at = models.DateTimeField(null=True,blank=True)
    revoked_at = models.DateTimeField(null=True)
    last_used_at = models.DateTimeField(null=True)

class Contact(ProjectRecord):
    phone = models.CharField(max_length=20)
    name = models.CharField(max_length=120,blank=True)
    attributes = models.JSONField(default=dict)
    class Meta: constraints = [models.UniqueConstraint(fields=['project','phone'],name='project_phone')]

class ContactConsent(Record):
    contact = models.ForeignKey(Contact,on_delete=models.CASCADE,related_name='consents')
    purpose = models.CharField(max_length=20,default='messaging')
    granted = models.BooleanField(default=True)
    basis = models.CharField(max_length=300)

class Message(ProjectRecord):
    connection = models.ForeignKey(WhatsAppConnection,on_delete=models.PROTECT)
    phone = models.CharField(max_length=20)
    kind = models.CharField(max_length=20,default='text')
    payload = models.JSONField(default=dict)
    direction = models.CharField(max_length=10,default='outbound')
    status = models.CharField(max_length=20,default='queued',db_index=True)
    provider_id = models.CharField(max_length=200,blank=True,db_index=True)
    idempotency_key = models.CharField(max_length=128)
    request_digest = models.CharField(max_length=64)
    scheduled_at = models.DateTimeField(default=timezone.now,db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    error = models.CharField(max_length=250,blank=True)
    class Meta: constraints = [models.UniqueConstraint(fields=['project','idempotency_key'],name='message_idempotency')]; indexes = [models.Index(fields=['project','-created_at'])]

class MessageEvent(Record):
    message = models.ForeignKey(Message,on_delete=models.CASCADE,related_name='events')
    status = models.CharField(max_length=30)
    event_key = models.CharField(max_length=250,unique=True)

class OTPChallenge(ProjectRecord):
    phone = models.CharField(max_length=20,db_index=True)
    code_hash = models.CharField(max_length=256)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(null=True)
    message = models.OneToOneField(Message,on_delete=models.SET_NULL,null=True)

class Workflow(ProjectRecord):
    name = models.CharField(max_length=120)
    status = models.CharField(max_length=20,default='draft')
    graph = models.JSONField(default=list)
    published_version = models.PositiveIntegerField(default=0)

class WorkflowVersion(Record):
    workflow = models.ForeignKey(Workflow,on_delete=models.CASCADE,related_name='versions')
    number = models.PositiveIntegerField()
    graph = models.JSONField(default=list)
    class Meta: constraints = [models.UniqueConstraint(fields=['workflow','number'],name='workflow_version')]

class WorkflowExecution(ProjectRecord):
    workflow = models.ForeignKey(Workflow,on_delete=models.CASCADE)
    version = models.PositiveIntegerField(default=0)
    graph = models.JSONField(default=list)
    context = models.JSONField(default=dict)
    cursor = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20,default='queued')
    resume_at = models.DateTimeField(default=timezone.now)
    logs = models.JSONField(default=list)
    error = models.CharField(max_length=250,blank=True)
    test_mode = models.BooleanField(default=False)
    retries = models.PositiveSmallIntegerField(default=0)

class WebhookEndpoint(ProjectRecord):
    url = models.URLField(max_length=500)
    events = models.JSONField(default=list)
    encrypted_secret = models.TextField()
    enabled = models.BooleanField(default=True)

class WebhookDelivery(Record):
    endpoint = models.ForeignKey(WebhookEndpoint,on_delete=models.CASCADE,related_name='deliveries')
    event_id = models.UUIDField(default=uuid.uuid4)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20,default='pending')
    attempts = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=timezone.now)
    response_code = models.IntegerField(null=True)
    class Meta: constraints = [models.UniqueConstraint(fields=['endpoint','event_id'],name='unique_delivery')]

class UsageRecord(ProjectRecord):
    kind = models.CharField(max_length=30)
    quantity = models.PositiveIntegerField(default=1)
    reference = models.CharField(max_length=250,unique=True)

class Subscription(Record):
    organization = models.OneToOneField(Organization,on_delete=models.CASCADE)
    plan = models.CharField(max_length=30,default='sandbox')
    status = models.CharField(max_length=20,default='active')
    # Accounting architecture only: no payment processor or automatic charges.

class AuditLog(Record):
    organization = models.ForeignKey(Organization,on_delete=models.CASCADE,null=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.SET_NULL,null=True)
    action = models.CharField(max_length=120)
    target = models.CharField(max_length=200,blank=True)

class AIConversation(ProjectRecord):
    prompt = models.TextField()
    response = models.TextField()
    handoff = models.BooleanField(default=True)

class AIUsage(ProjectRecord):
    tokens = models.PositiveIntegerField()
    conversation = models.ForeignKey(AIConversation,on_delete=models.CASCADE,null=True)

class MessageTemplate(ProjectRecord):
    name = models.CharField(max_length=120)
    language = models.CharField(max_length=12,default='en_US')
    category = models.CharField(max_length=20,choices=[('utility','Utility'),('authentication','Authentication'),('marketing','Marketing')],default='utility')
    components = models.JSONField(default=list)
    # This is a local draft registry. Provider approval is never inferred.
    class Meta: constraints=[models.UniqueConstraint(fields=['project','name','language'],name='project_template')]
