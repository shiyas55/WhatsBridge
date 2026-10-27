from rest_framework import serializers
from .models import *


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "organization",
            "name",
            "sandbox",
            "ai_enabled",
            "ai_token_limit",
            "faq",
            "created_at",
        ]
        read_only_fields = ["organization", "created_at"]


class ConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppConnection
        fields = [
            "id",
            "project",
            "name",
            "provider",
            "status",
            "phone_number_id",
            "last_connected_at",
            "error",
            "created_at",
        ]
        read_only_fields = [
            "project",
            "status",
            "last_connected_at",
            "error",
            "created_at",
        ]

    def validate(self, data):
        if self.instance and any(
            k in data and data[k] != getattr(self.instance, k)
            for k in ("provider", "phone_number_id")
        ):
            raise serializers.ValidationError(
                "Provider identity is immutable; use onboarding or a new connection"
            )
        return data


class MessageSerializer(serializers.ModelSerializer):
    payload = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "project",
            "connection",
            "phone",
            "kind",
            "payload",
            "direction",
            "status",
            "provider_id",
            "scheduled_at",
            "attempts",
            "error",
            "created_at",
        ]

    def get_payload(self, obj) -> dict:
        return (
            {"redacted": True}
            if "encrypted_otp" in obj.payload or hasattr(obj, "otpchallenge")
            else obj.payload
        )


class ContactSerializer(serializers.ModelSerializer):
    consent = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = [
            "id",
            "project",
            "phone",
            "name",
            "attributes",
            "consent",
            "created_at",
        ]
        read_only_fields = ["project", "created_at"]

    def get_consent(self, obj) -> list[dict]:
        return list(
            obj.consents.order_by("-created_at").values(
                "purpose", "granted", "basis", "created_at"
            )[:10]
        )

    def validate_phone(self, value):
        from .services import phone_number

        return phone_number(value)


class WorkflowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workflow
        fields = [
            "id",
            "project",
            "name",
            "status",
            "graph",
            "published_version",
            "created_at",
        ]
        read_only_fields = ["project", "status", "published_version", "created_at"]

    def validate_graph(self, value):
        from .services import graph_validate

        return graph_validate(value)


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEndpoint
        fields = ["id", "project", "url", "events", "enabled", "created_at"]
        read_only_fields = ["project", "created_at"]

    def validate_url(self, value):
        from .security import safe_url

        return safe_url(value)

    def validate_events(self, value):
        from .services import EVENTS

        if (
            not isinstance(value, list)
            or not value
            or not all(isinstance(v, str) and v in EVENTS for v in value)
        ):
            raise serializers.ValidationError("Select supported webhook events")
        return value


class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = [
            "id",
            "project",
            "name",
            "prefix",
            "scopes",
            "ip_allowlist",
            "expires_at",
            "revoked_at",
            "last_used_at",
            "created_at",
        ]
        read_only_fields = [
            "project",
            "prefix",
            "revoked_at",
            "last_used_at",
            "created_at",
        ]

    def validate_scopes(self, value):
        from .security import SCOPES

        if (
            not isinstance(value, list)
            or not value
            or not all(isinstance(v, str) and v in SCOPES for v in value)
        ):
            raise serializers.ValidationError("Unsupported scope")
        return value

    def validate_ip_allowlist(self, value):
        import ipaddress

        try:
            if not isinstance(value, list):
                raise ValueError()
            for ip in value:
                ipaddress.ip_address(ip)
        except ValueError:
            raise serializers.ValidationError("Use a list of IP addresses")
        return value

    def validate_expires_at(self, value):
        from django.utils import timezone

        if value and value <= timezone.now():
            raise serializers.ValidationError("Expiration must be in the future")
        return value


class MessageRequestSerializer(serializers.Serializer):
    connection = serializers.UUIDField()
    phone = serializers.CharField(
        help_text="E.164 phone number with recorded messaging consent"
    )
    kind = serializers.ChoiceField(
        choices=["text", "template", "image", "document", "video", "audio"],
        default="text",
    )
    payload = serializers.JSONField(
        help_text='Text: {"body":"Hello"}; template: {"name":"approved_name","language":"en_US","components":[]}; media: {"link":"https://..."}'
    )
    scheduled_at = serializers.DateTimeField(required=False)


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = [
            "id",
            "project",
            "name",
            "language",
            "category",
            "components",
            "created_at",
        ]
        read_only_fields = ["project", "created_at"]

    def validate(self, data):
        from .services import validate_payload

        merged = {
            **(
                {
                    "name": self.instance.name,
                    "language": self.instance.language,
                    "components": self.instance.components,
                }
                if self.instance
                else {}
            ),
            **data,
        }
        validate_payload("template", merged)
        return data
