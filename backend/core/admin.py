from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import *

admin.site.site_header = "WhatsBridge administration"


@admin.register(User)
class SecureUserAdmin(UserAdmin):
    def get_queryset(self, request):
        return super().get_queryset(request)


# Credentials, OTP hashes, and key digests are deliberately absent from Django admin.
class AuditedAdmin(admin.ModelAdmin):
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        AuditLog.objects.create(
            actor=request.user,
            action="admin.save." + obj.__class__.__name__,
            target=str(obj.pk),
        )

    def delete_model(self, request, obj):
        AuditLog.objects.create(
            actor=request.user,
            action="admin.delete." + obj.__class__.__name__,
            target=str(obj.pk),
        )
        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            self.delete_model(request, obj)


for model in [
    Organization,
    OrganizationMembership,
    Project,
    Subscription,
    WhatsAppConnection,
    Contact,
    Workflow,
    WorkflowExecution,
    WebhookDelivery,
    UsageRecord,
    AIUsage,
]:
    admin.site.register(model, AuditedAdmin)


@admin.register(AuditLog)
class AuditAdmin(admin.ModelAdmin):
    list_display = ["created_at", "organization", "actor", "action", "target"]
    readonly_fields = ["id", "created_at", "organization", "actor", "action", "target"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# Reuse the verified-email/TOTP login flow; Django's stock password-only form
# must not bypass two-factor authentication configured on the account.
from django.shortcuts import redirect

admin.site.login = lambda request, extra_context=None: redirect("/?admin=1")
admin.site.has_permission = lambda request: bool(
    request.user.is_active
    and request.user.is_staff
    and request.user.email_verified
    and (not request.user.totp_enabled or request.session.get("mfa_verified"))
)
