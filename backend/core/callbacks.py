import hashlib, hmac, json
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.utils import timezone
from .models import *
from .security import decrypt
from .services import emit


@csrf_exempt
def meta_callback(request, connection_id):
    connection = (
        WhatsAppConnection.objects.select_related("project__organization")
        .filter(
            pk=connection_id,
            provider="meta",
            status="CONNECTED",
            project__organization__suspended=False,
        )
        .first()
    )
    if (
        not connection
        or not ProviderCredential.objects.filter(connection=connection).exists()
    ):
        return HttpResponse(status=404)
    credentials = decrypt(connection.credential.encrypted)
    if request.method == "GET":
        if request.GET.get("hub.mode") == "subscribe" and hmac.compare_digest(
            request.GET.get("hub.verify_token", ""), credentials["verify_token"]
        ):
            return HttpResponse(
                request.GET.get("hub.challenge", ""), content_type="text/plain"
            )
        return HttpResponse(status=403)
    if request.method != "POST":
        return HttpResponse(status=405)
    if len(request.body) > 1000000:
        return HttpResponse(status=413)
    expected = (
        "sha256="
        + hmac.new(
            credentials["app_secret"].encode(), request.body, hashlib.sha256
        ).hexdigest()
    )
    if not hmac.compare_digest(
        expected, request.headers.get("X-Hub-Signature-256", "")
    ):
        return HttpResponse(status=403)
    try:
        body = json.loads(request.body)
        with transaction.atomic():
            for entry in body.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    if (
                        str(value.get("metadata", {}).get("phone_number_id"))
                        != connection.phone_number_id
                    ):
                        continue
                    for event in value.get("statuses", []):
                        state = event.get("status")
                        if state not in ["sent", "delivered", "read", "failed"]:
                            continue
                        msg = (
                            Message.objects.select_for_update()
                            .filter(connection=connection, provider_id=event.get("id"))
                            .first()
                        )
                        # opaque callback data allows receipts that race the send response.
                        if not msg and event.get("biz_opaque_callback_data"):
                            msg = (
                                Message.objects.select_for_update()
                                .filter(
                                    connection=connection,
                                    id=event["biz_opaque_callback_data"],
                                )
                                .first()
                            )
                        if not msg:
                            continue
                        _, fresh = MessageEvent.objects.get_or_create(
                            event_key=f"meta:{connection.id}:{event['id']}:{state}",
                            defaults={"message": msg, "status": state},
                        )
                        if fresh:
                            ranks = {
                                "queued": 0,
                                "processing": 1,
                                "unknown": 1,
                                "accepted": 1,
                                "sent": 2,
                                "failed": 2,
                                "delivered": 3,
                                "read": 4,
                            }
                            if ranks[state] > ranks.get(msg.status, 0):
                                msg.status = state
                            msg.provider_id = event["id"]
                            msg.save()
                            emit(
                                connection.project,
                                "message." + state,
                                {"message_id": str(msg.id), "provider_id": event["id"]},
                            )
                    for incoming in value.get("messages", []):
                        pid = incoming["id"]
                        phone = "+" + incoming["from"].lstrip("+")
                        msg, fresh = Message.objects.get_or_create(
                            project=connection.project,
                            idempotency_key="in:"
                            + hashlib.sha256(
                                (str(connection.id) + pid).encode()
                            ).hexdigest(),
                            defaults={
                                "connection": connection,
                                "phone": phone,
                                "kind": incoming.get("type", "text"),
                                "payload": {
                                    "body": incoming.get("text", {}).get("body", "")
                                },
                                "direction": "inbound",
                                "status": "received",
                                "provider_id": pid,
                                "request_digest": "",
                            },
                        )
                        if fresh:
                            emit(
                                connection.project,
                                "message.received",
                                {"message_id": str(msg.id)},
                            )
                            # Published workflows with an explicit incoming trigger run once.
                            for flow in Workflow.objects.filter(
                                project=connection.project, status="published"
                            ):
                                version = flow.versions.get(
                                    number=flow.published_version
                                )
                                if (
                                    version.graph
                                    and version.graph[0].get("event")
                                    == "message.received"
                                ):
                                    WorkflowExecution.objects.create(
                                        project=connection.project,
                                        workflow=flow,
                                        version=version.number,
                                        graph=version.graph,
                                        context={
                                            "phone": phone,
                                            "question": msg.payload.get("body", ""),
                                            "message_id": str(msg.id),
                                        },
                                    )
    except (ValueError, KeyError, TypeError):
        return HttpResponse(status=400)
    return JsonResponse({"received": True})
