import os
from pathlib import Path
from urllib.parse import urlparse
from .environment import service_url, database_config
BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv('DEBUG', '0') == '1'
TESTING = os.getenv('TESTING', '0') == '1'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'test-only-secret' if TESTING else '')
if not SECRET_KEY:
    raise RuntimeError('Set DJANGO_SECRET_KEY before starting')
ALLOWED_HOSTS = [h.strip() for h in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,backend,testserver,whatsbridge-backend.onrender.com,.onrender.com').split(',') if h.strip()]
INSTALLED_APPS = ['django.contrib.admin','django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','rest_framework','corsheaders','drf_spectacular','channels','core']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware','corsheaders.middleware.CorsMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.contrib.messages.middleware.MessageMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'config.urls'
ASGI_APPLICATION = 'config.asgi.application'
TEMPLATES = [{'BACKEND':'django.template.backends.django.DjangoTemplates','DIRS':[],'APP_DIRS':True,'OPTIONS':{'context_processors':['django.template.context_processors.request','django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
AUTH_USER_MODEL = 'core.User'
AUTH_PASSWORD_VALIDATORS = [{'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator','OPTIONS':{'min_length':12}},{'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},{'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'}]
DATABASES = {'default': database_config(os.getenv('DATABASE_URL','postgres://whatsbridge:whatsbridge@db:5432/whatsbridge'))}
if TESTING:
    DATABASES = {'default': {'ENGINE':'django.db.backends.sqlite3','NAME':BASE_DIR/'test-dev.sqlite3'}}
REDIS_URL = os.getenv('REDIS_URL', '')
if REDIS_URL and not TESTING:
    CACHES = {'default': {'BACKEND':'django.core.cache.backends.redis.RedisCache','LOCATION':REDIS_URL}}
    CHANNEL_LAYERS = {'default': {'BACKEND':'channels_redis.core.RedisChannelLayer','CONFIG':{'hosts':[REDIS_URL]}}}
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
else:
    CACHES = {'default': {'BACKEND':'django.core.cache.backends.locmem.LocMemCache'}}
    CHANNEL_LAYERS = {'default': {'BACKEND':'channels.layers.InMemoryChannelLayer'}}
    CELERY_BROKER_URL = 'memory://'
    CELERY_RESULT_BACKEND = 'cache+memory://'
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BEAT_SCHEDULE = {'dispatch-due': {'task':'core.tasks.dispatch_due','schedule':10.0},'retention':{'task':'core.tasks.retention','schedule':86400.0}}
REST_FRAMEWORK = {'DEFAULT_AUTHENTICATION_CLASSES':['core.security.ProjectKeyAuthentication','rest_framework.authentication.SessionAuthentication'],'DEFAULT_PERMISSION_CLASSES':['rest_framework.permissions.IsAuthenticated'],'DEFAULT_SCHEMA_CLASS':'drf_spectacular.openapi.AutoSchema','DEFAULT_PAGINATION_CLASS':'rest_framework.pagination.PageNumberPagination','PAGE_SIZE':50,'EXCEPTION_HANDLER':'core.security.exception_handler'}
SPECTACULAR_SETTINGS = {'TITLE':'WhatsBridge API','VERSION':'1.0.0','SERVE_INCLUDE_SCHEMA':False,'COMPONENT_SPLIT_REQUEST':True}
USE_TZ = True
TIME_ZONE = 'UTC'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR/'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.getenv('CORS_ALLOWED_ORIGINS','http://localhost:3000,http://localhost:8080,https://whats-bridge.vercel.app').split(',') if o.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv('CSRF_TRUSTED_ORIGINS','http://localhost:3000,http://localhost:8080,https://whats-bridge.vercel.app,https://*.vercel.app,https://whatsbridge-backend.onrender.com').split(',') if o.strip()]
CORS_ALLOW_CREDENTIALS = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG and not TESTING
CSRF_COOKIE_SECURE = not DEBUG and not TESTING
SESSION_COOKIE_SAMESITE = 'Lax'
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT','0') == '1'
SECURE_HSTS_SECONDS = 31536000 if not DEBUG and not TESTING else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND','django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST','mailpit')
EMAIL_PORT = int(os.getenv('EMAIL_PORT','1025'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER','')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD','')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS','0') == '1'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL','WhatsBridge <hello@localhost>')
PUBLIC_URL = os.getenv('PUBLIC_URL','http://localhost:8080')
GATEWAY_URL = service_url(os.getenv('GATEWAY_URL','http://gateway:4000'))
GATEWAY_TOKEN = os.getenv('GATEWAY_TOKEN','test-gateway' if TESTING else '')
CREDENTIAL_KEY = os.getenv('CREDENTIAL_KEY','')
META_GRAPH_VERSION = os.getenv('META_GRAPH_VERSION','')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY','')
GEMINI_MODEL = os.getenv('GEMINI_MODEL','')
WEBHOOK_ALLOWED_HOSTS = os.getenv('WEBHOOK_ALLOWED_HOSTS','').split(',')
LOGGING = {'version':1,'disable_existing_loggers':False,'handlers':{'console':{'class':'logging.StreamHandler'}},'root':{'handlers':['console'],'level':'WARNING'}}

OTP_TEMPLATE_NAMES = [x for x in os.getenv('OTP_TEMPLATE_NAMES','').split(',') if x]
DATA_UPLOAD_MAX_MEMORY_SIZE = 1048576

if TESTING and os.getenv('TEST_DATABASE_URL'):
    test_db = urlparse(os.environ['TEST_DATABASE_URL'])
    DATABASES = {'default': {'ENGINE':'django.db.backends.postgresql','NAME':test_db.path[1:],'USER':test_db.username or '', 'PASSWORD':test_db.password or '', 'HOST':test_db.hostname or '', 'PORT':test_db.port or 5432}}
if os.getenv('TRUST_PROXY','0') == '1':
    # Only valid when Django is inaccessible except through our Nginx proxy.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO','https')

REST_FRAMEWORK['DEFAULT_PARSER_CLASSES'] = ['core.parsers.ObjectJSONParser']

BAILEYS_ENABLED = os.getenv('BAILEYS_ENABLED','1') == '1'
BAILEYS_URL = service_url(os.getenv('BAILEYS_URL','https://whatsbridge-gateway.onrender.com' if not TESTING else 'http://127.0.0.1:14001'))
BAILEYS_TOKEN = os.getenv('BAILEYS_TOKEN', os.getenv('GATEWAY_TOKEN', 'baileys_default_secret_token_1234567890_secure'))
if TESTING and os.getenv('LOCAL_DB_PATH'):
    DATABASES['default'] = {'ENGINE':'django.db.backends.sqlite3','NAME':os.environ['LOCAL_DB_PATH']}

EMAIL_FILE_PATH = os.getenv("EMAIL_FILE_PATH", "/tmp/whatsbridge-mail")

# Explicit research opt-in; no supported production delivery guarantee.
BAILEYS_OTP_ENABLED = os.getenv('BAILEYS_OTP_ENABLED','0') == '1'
