from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from core.views import *
from core.auth import auth
from core.otp import otp
from core.ai import ai
from core.callbacks import meta_callback
from core.health import health, metrics

router = DefaultRouter(trailing_slash=False)
for name, view in [
    ("connections", ConnectionViewSet),
    ("messages", MessageViewSet),
    ("keys", KeyViewSet),
    ("contacts", ContactViewSet),
    ("workflows", WorkflowViewSet),
    ("webhooks", WebhookViewSet),
    ("templates", TemplateViewSet),
]:
    router.register(name, view, basename=name)
urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", health),
    path("metrics", metrics),
    path("api/auth/<str:action>", auth),
    path("api/organizations", organizations),
    path("api/projects", projects),
    path("api/team", team),
    path("api/overview", overview),
    path("api/platform", platform),
    path("api/ai", ai),
    path("api/v1/otp/send", otp, {"action": "send"}),
    path("api/v1/otp/verify", otp, {"action": "verify"}),
    path("api/v1/", include(router.urls)),
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/providers/meta/<uuid:connection_id>", meta_callback),
]
