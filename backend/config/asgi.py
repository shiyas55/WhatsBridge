import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
from django.core.asgi import get_asgi_application
django_asgi=get_asgi_application()
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import path
from core.realtime import ProjectEvents
application=ProtocolTypeRouter({'http':django_asgi,'websocket':AllowedHostsOriginValidator(AuthMiddlewareStack(URLRouter([path('ws/projects/<uuid:project_id>',ProjectEvents.as_asgi())])))})
