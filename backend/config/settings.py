import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file from project root if present
_env_path = BASE_DIR.parent / ".env"
if _env_path.exists():
    with open(_env_path, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                _k = _k.strip()
                _v = _v.strip().strip('"').strip("'")
                if _k not in os.environ:
                    os.environ[_k] = _v

DEBUG = os.getenv("DEBUG", "0") == "1"
TESTING = os.getenv("TESTING", "0") == "1"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "test-only-secret" if TESTING else "")
if not SECRET_KEY:
    raise RuntimeError("Set DJANGO_SECRET_KEY before starting")
_allowed_env = os.getenv("ALLOWED_HOSTS", "").strip()
ALLOWED_HOSTS = list(set([x.strip() for x in _allowed_env.split(",") if x.strip()] + ["localhost", "127.0.0.1", "backend", "testserver", ".onrender.com", ".vercel.app", "*"]))
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    "channels",
    "core",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
AUTH_USER_MODEL = "core.User"
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
_raw_db = os.getenv("DATABASE_URL", "postgres://whatsbridge:whatsbridge@db:5432/whatsbridge")
if _raw_db.startswith(('"', "'")) and _raw_db.endswith(('"', "'")):
    _raw_db = _raw_db[1:-1]

u = urlparse(_raw_db)
_qp = parse_qs(u.query)
_db_options = {}
if "sslmode" in _qp:
    _db_options["sslmode"] = _qp["sslmode"][0]
if "channel_binding" in _qp:
    _db_options["channel_binding"] = _qp["channel_binding"][0]

_is_pooled = bool(u.hostname and "-pooler" in u.hostname)

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": u.path[1:],
        "USER": u.username,
        "PASSWORD": u.password,
        "HOST": u.hostname,
        "PORT": u.port or 5432,
        "CONN_MAX_AGE": 600,
        "OPTIONS": _db_options,
    }
}
if os.getenv("USE_SQLITE", "0") == "1":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "test-dev.sqlite3",
        }
    }
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# If Redis host cannot be resolved (e.g. running locally outside docker network), fallback to in-memory
_redis_host = urlparse(REDIS_URL).hostname
if _redis_host:
    import socket
    try:
        socket.gethostbyname(_redis_host)
    except socket.gaierror:
        CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
        CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

if TESTING:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_ALWAYS_EAGER = TESTING
CELERY_TASK_EAGER_PROPAGATES = TESTING
CELERY_BEAT_SCHEDULE = {
    "dispatch-due": {"task": "core.tasks.dispatch_due", "schedule": 10.0},
    "retention": {"task": "core.tasks.retention", "schedule": 86400.0},
}
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.security.ProjectKeyAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "core.security.exception_handler",
}
SPECTACULAR_SETTINGS = {
    "TITLE": "WhatsBridge API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}
USE_TZ = True
TIME_ZONE = "UTC"
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
_cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
CORS_ALLOWED_ORIGINS = list(set([x.strip() for x in _cors_env.split(",") if x.strip()] + [
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
]))
CORS_ALLOW_ALL_ORIGINS = DEBUG or os.getenv("CORS_ALLOW_ALL", "0") == "1"
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https:\/\/.*\.vercel\.app$",
    r"^https:\/\/.*\.onrender\.com$",
    r"^https:\/\/.*\.railway\.app$",
    r"^https:\/\/.*\.koyeb\.app$",
]

_csrf_env = os.getenv("CSRF_TRUSTED_ORIGINS", "").strip()
CSRF_TRUSTED_ORIGINS = list(set([x.strip() for x in _csrf_env.split(",") if x.strip()] + [
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
    "https://*.vercel.app",
    "https://*.onrender.com",
    "https://*.railway.app",
    "https://*.koyeb.app",
]))
CORS_ALLOW_CREDENTIALS = True
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG and not TESTING
CSRF_COOKIE_SECURE = not DEBUG and not TESTING
SESSION_COOKIE_SAMESITE = "Lax"
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "0") == "1"
SECURE_HSTS_SECONDS = 31536000 if not DEBUG and not TESTING else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "mailpit")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "1025"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "0") == "1"
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "WhatsBridge <hello@localhost>")
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:8080")
GATEWAY_URL = os.getenv("GATEWAY_URL", "http://gateway:4000")
try:
    _gw_host = urlparse(GATEWAY_URL).hostname
    if _gw_host:
        import socket
        socket.gethostbyname(_gw_host)
except Exception:
    GATEWAY_URL = "http://127.0.0.1:4000"

GATEWAY_TOKEN = os.getenv("GATEWAY_TOKEN", "test-gateway" if TESTING else "")
CREDENTIAL_KEY = os.getenv("CREDENTIAL_KEY", "")
META_GRAPH_VERSION = os.getenv("META_GRAPH_VERSION", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "")
_wh_env = (os.getenv("WEBHOOK_ALLOWED_HOSTS") or "").strip()
WEBHOOK_ALLOWED_HOSTS = [x.strip() for x in (_wh_env if _wh_env else "example.com,webhook.site,httpbin.org").split(",") if x.strip()]
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
}

OTP_TEMPLATE_NAMES = [x for x in os.getenv("OTP_TEMPLATE_NAMES", "").split(",") if x]
DATA_UPLOAD_MAX_MEMORY_SIZE = 1048576

if TESTING and os.getenv("TEST_DATABASE_URL"):
    test_db = urlparse(os.environ["TEST_DATABASE_URL"])
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": test_db.path[1:],
            "USER": test_db.username or "",
            "PASSWORD": test_db.password or "",
            "HOST": test_db.hostname or "",
            "PORT": test_db.port or 5432,
        }
    }
if os.getenv("TRUST_PROXY", "1") == "1" or not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

REST_FRAMEWORK["DEFAULT_PARSER_CLASSES"] = ["core.parsers.ObjectJSONParser"]

SECURE_REDIRECT_EXEMPT = [r'^health$']
SESSION_COOKIE_AGE = 43200
