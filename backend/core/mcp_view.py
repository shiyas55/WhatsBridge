import json
import uuid
import time
import secrets
from datetime import timedelta
from django.conf import settings
from django.http import StreamingHttpResponse, JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth.hashers import make_password
from .models import APIKey, Project, WhatsAppConnection, OTPChallenge, Organization, OrganizationMembership, Message
from .security import digest
from .services import queue_message, phone_number

MCP_TOOLS = [
    {
        "name": "send_whatsapp_message",
        "description": "Send a real WhatsApp message to any phone number in international E.164 format (e.g. +919567334117).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "phone": {
                    "type": "string",
                    "description": "Recipient phone number in E.164 format (e.g. +919567334117)"
                },
                "text": {
                    "type": "string",
                    "description": "Message text to deliver to the recipient"
                },
                "connection_id": {
                    "type": "string",
                    "description": "Optional WhatsApp Connection UUID. If omitted, uses the first active connection."
                }
            },
            "required": ["phone", "text"]
        }
    },
    {
        "name": "send_whatsapp_otp",
        "description": "Generate and dispatch a secure 6-digit WhatsApp OTP verification challenge to a phone number.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "phone": {
                    "type": "string",
                    "description": "Recipient phone number in E.164 format (e.g. +919567334117)"
                },
                "ttl_seconds": {
                    "type": "integer",
                    "default": 300,
                    "description": "Expiration time in seconds (60-600)"
                }
            },
            "required": ["phone"]
        }
    },
    {
        "name": "verify_whatsapp_otp",
        "description": "Verify the 6-digit WhatsApp OTP submitted by the user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "challenge_id": {
                    "type": "string",
                    "description": "Challenge UUID returned from send_whatsapp_otp"
                },
                "code": {
                    "type": "string",
                    "description": "The 6-digit verification code"
                }
            },
            "required": ["challenge_id", "code"]
        }
    },
    {
        "name": "list_whatsapp_connections",
        "description": "List all active WhatsApp transport connections in your project.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    }
]

def _authenticate_mcp_request(request, body_params=None):
    """
    Resolves project and API key principal from Bearer token or session.
    """
    header = request.headers.get('Authorization', '')
    token = None
    if header.startswith('Bearer '):
        token = header[7:].strip()
    elif body_params and isinstance(body_params, dict) and body_params.get('api_key'):
        token = str(body_params.get('api_key')).strip()
    
    if token:
        key = APIKey.objects.select_related('project__organization').filter(
            digest=digest(token),
            revoked_at=None
        ).first()
        if key and not (key.expires_at and key.expires_at <= timezone.now()) and not key.project.organization.suspended:
            APIKey.objects.filter(pk=key.pk).update(last_used_at=timezone.now())
            return key.project, key
    
    if request.user and request.user.is_authenticated:
        membership = OrganizationMembership.objects.filter(user=request.user, organization__suspended=False).first()
        if membership:
            proj = Project.objects.filter(organization=membership.organization).first()
            if proj:
                return proj, None
                
    return None, None

def _execute_mcp_tool(project, name, args):
    if name == 'send_whatsapp_message':
        phone = str(args.get('phone', '')).strip()
        text = str(args.get('text', '')).strip()
        if not phone or not text:
            return {"isError": True, "text": "Both 'phone' and 'text' arguments are required."}
        
        try:
            clean_phone = phone_number(phone)
        except Exception as e:
            return {"isError": True, "text": f"Invalid phone format: {str(e)}"}
            
        conn_id = args.get('connection_id')
        conn = None
        if conn_id:
            conn = WhatsAppConnection.objects.filter(project=project, id=conn_id).first()
        if not conn:
            conn = WhatsAppConnection.objects.filter(project=project, status='CONNECTED').first() or WhatsAppConnection.objects.filter(project=project).first()
            
        if not conn:
            return {"isError": True, "text": "No WhatsApp connection found in this project. Please link WhatsApp Web in your dashboard first."}
            
        idem_key = f"mcp-msg-{uuid.uuid4().hex[:12]}"
        msg, created = queue_message(
            project,
            {
                'connection': str(conn.id),
                'phone': clean_phone,
                'kind': 'text',
                'payload': {'body': text}
            },
            idem_key
        )
        return {
            "isError": False,
            "text": f"WhatsApp message queued successfully! ID: {msg.id}, Status: {msg.status}, Recipient: {clean_phone}, Connection: {conn.name}"
        }

    elif name == 'send_whatsapp_otp':
        phone = str(args.get('phone', '')).strip()
        if not phone:
            return {"isError": True, "text": "'phone' argument is required."}
        try:
            clean_phone = phone_number(phone)
        except Exception as e:
            return {"isError": True, "text": f"Invalid phone format: {str(e)}"}

        conn = WhatsAppConnection.objects.filter(project=project, status='CONNECTED').first() or WhatsAppConnection.objects.filter(project=project).first()
        if not conn:
            return {"isError": True, "text": "No WhatsApp connection found in this project."}

        ttl = int(args.get('ttl_seconds', 300))
        code = f"{secrets.randbelow(1000000):06d}"
        challenge = OTPChallenge.objects.create(
            project=project,
            phone=clean_phone,
            code_hash=make_password(code),
            expires_at=timezone.now() + timedelta(seconds=ttl)
        )
        
        idem_key = f"mcp-otp-{uuid.uuid4().hex[:12]}"
        queue_message(
            project,
            {
                'connection': str(conn.id),
                'phone': clean_phone,
                'kind': 'text',
                'payload': {'body': f"Your verification code is {code}. It expires in {ttl // 60} minutes."}
            },
            idem_key,
            otp=True
        )
        return {
            "isError": False,
            "text": f"OTP challenge dispatched to {clean_phone}. Challenge ID: {challenge.id}, TTL: {ttl}s"
        }

    elif name == 'verify_whatsapp_otp':
        challenge_id = str(args.get('challenge_id', '')).strip()
        code = str(args.get('code', '')).strip()
        if not challenge_id or not code:
            return {"isError": True, "text": "Both 'challenge_id' and 'code' are required."}

        from django.contrib.auth.hashers import check_password
        ch = OTPChallenge.objects.filter(project=project, id=challenge_id).first()
        if not ch:
            return {"isError": True, "text": "OTP challenge not found."}
        if ch.verified_at:
            return {"isError": True, "text": "OTP already verified."}
        if ch.expires_at < timezone.now():
            return {"isError": True, "text": "OTP challenge expired."}
        if not check_password(code, ch.code_hash):
            return {"isError": True, "text": "Invalid verification code."}

        ch.verified_at = timezone.now()
        ch.save(update_fields=['verified_at'])
        return {
            "isError": False,
            "text": f"OTP verification successful! Phone: {ch.phone}, Verified at: {ch.verified_at.isoformat()}"
        }

    elif name == 'list_whatsapp_connections':
        conns = WhatsAppConnection.objects.filter(project=project).values('id', 'name', 'provider', 'status', 'phone_number')
        return {
            "isError": False,
            "text": json.dumps(list(conns), default=str, indent=2)
        }

    return {"isError": True, "text": f"Unknown tool: {name}"}

@api_view(['GET'])
@permission_classes([AllowAny])
def mcp_openapi_spec(request):
    """
    Returns a public OpenAPI 3.1.0 specification for ChatGPT Actions,
    Claude, and other AI agents to auto-import WhatsBridge messaging capabilities.
    """
    base_url = getattr(settings, 'PUBLIC_BACKEND_URL', 'https://whatsbridge-backend.onrender.com').rstrip('/')

    schema = {
        "openapi": "3.1.0",
        "info": {
            "title": "WhatsBridge AI MCP & Action Server",
            "version": "1.0.0",
            "description": "Send WhatsApp messages, dispatch OTP verification codes, verify challenges, and inspect live WhatsApp Web/Meta connections using your WhatsBridge tenant account."
        },
        "servers": [
            {
                "url": base_url,
                "description": "WhatsBridge Production API Gateway"
            }
        ],
        "components": {
            "securitySchemes": {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "wb_live_...",
                    "description": "Enter your scoped WhatsBridge API Key (e.g. wb_live_... or wb_test_...)"
                }
            }
        },
        "security": [
            {
                "BearerAuth": []
            }
        ],
        "paths": {
            "/api/v1/messages": {
                "post": {
                    "summary": "Send WhatsApp Message",
                    "operationId": "send_whatsapp_message",
                    "description": "Send a real WhatsApp message to any phone number in international E.164 format (e.g. +919567334117).",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["connection", "phone", "kind", "payload"],
                                    "properties": {
                                        "connection": {
                                            "type": "string",
                                            "description": "Your WhatsApp Connection UUID (from your WhatsBridge Dashboard)"
                                        },
                                        "phone": {
                                            "type": "string",
                                            "description": "Recipient phone number in E.164 format (e.g. +919567334117)"
                                        },
                                        "kind": {
                                            "type": "string",
                                            "enum": ["text"],
                                            "default": "text",
                                            "description": "Message type"
                                        },
                                        "payload": {
                                            "type": "object",
                                            "required": ["body"],
                                            "properties": {
                                                "body": {
                                                    "type": "string",
                                                    "description": "The message text to deliver to the recipient"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "202": {
                            "description": "Message queued for delivery",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "id": {"type": "string"},
                                            "status": {"type": "string"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/otp/send": {
                "post": {
                    "summary": "Send WhatsApp OTP",
                    "operationId": "send_whatsapp_otp",
                    "description": "Generate and dispatch a secure 6-digit WhatsApp OTP verification challenge to a phone number.",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["phone"],
                                    "properties": {
                                        "phone": {
                                            "type": "string",
                                            "description": "Recipient phone number in international E.164 format (e.g. +919567334117)"
                                        },
                                        "project": {
                                            "type": "string",
                                            "description": "Optional project UUID"
                                        },
                                        "connection": {
                                            "type": "string",
                                            "description": "Optional WhatsApp Connection UUID"
                                        },
                                        "ttl_seconds": {
                                            "type": "integer",
                                            "default": 300,
                                            "description": "Code expiration time in seconds (60-600)"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "OTP challenge created and delivered via WhatsApp"
                        }
                    }
                }
            },
            "/api/v1/otp/verify": {
                "post": {
                    "summary": "Verify WhatsApp OTP",
                    "operationId": "verify_whatsapp_otp",
                    "description": "Verify the 6-digit WhatsApp OTP submitted by the user.",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["challenge_id", "code"],
                                    "properties": {
                                        "challenge_id": {
                                            "type": "string",
                                            "description": "Challenge UUID returned from the send OTP step"
                                        },
                                        "code": {
                                            "type": "string",
                                            "description": "The 6-digit verification code"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "OTP verified successfully, signed proof token returned"
                        }
                    }
                }
            },
            "/api/v1/connections": {
                "get": {
                    "summary": "List WhatsApp Connections",
                    "operationId": "list_whatsapp_connections",
                    "description": "List all active WhatsApp transport connections in your project.",
                    "responses": {
                        "200": {
                            "description": "Array of WhatsApp connections"
                        }
                    }
                }
            },
            "/api/v1/messages/bulk": {
                "post": {
                    "summary": "Broadcast WhatsApp Messages",
                    "operationId": "send_bulk_whatsapp_broadcast",
                    "description": "Send a broadcast message to multiple WhatsApp recipients with anti-spam rate pacing.",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["phones", "body"],
                                    "properties": {
                                        "phones": {
                                            "type": "string",
                                            "description": "Newline or comma-separated phone numbers"
                                        },
                                        "body": {
                                            "type": "string",
                                            "description": "Message text to broadcast"
                                        },
                                        "connection": {
                                            "type": "string",
                                            "description": "Optional WhatsApp Connection UUID"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "202": {
                            "description": "Bulk broadcast enqueued"
                        }
                    }
                }
            }
        }
    }
    return Response(schema)

def mcp_sse(request):
    """
    Server-Sent Events endpoint for Claude Web and Remote MCP clients.
    Immediately yields the message submission endpoint URL and maintains connection.
    """
    base_url = getattr(settings, 'PUBLIC_BACKEND_URL', 'https://whatsbridge-backend.onrender.com').rstrip('/')
    session_id = str(uuid.uuid4())
    endpoint_url = f"{base_url}/api/mcp/messages?session_id={session_id}"

    def event_stream():
        yield f"event: endpoint\ndata: {endpoint_url}\n\n"
        for _ in range(6):
            time.sleep(15)
            yield ": keep-alive\n\n"

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache, no-transform'
    response['X-Accel-Buffering'] = 'no'
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Headers'] = '*'
    return response

@csrf_exempt
def mcp_messages(request):
    """
    JSON-RPC 2.0 message handler for standard MCP clients (Claude Web, Claude Desktop, Cursor).
    """
    if request.method == 'OPTIONS':
        resp = HttpResponse()
        resp['Access-Control-Allow-Origin'] = '*'
        resp['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Idempotency-Key'
        return resp

    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}}, status=400)

    req_id = body.get('id')
    method = body.get('method')
    params = body.get('params', {})

    if method == 'initialize':
        resp_data = {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "whatsbridge",
                    "version": "1.0.0"
                }
            }
        }
        resp = JsonResponse(resp_data)
        resp['Access-Control-Allow-Origin'] = '*'
        return resp

    if method in ('notifications/initialized', 'initialized'):
        resp = HttpResponse(status=204)
        resp['Access-Control-Allow-Origin'] = '*'
        return resp

    if method == 'ping':
        resp = JsonResponse({"jsonrpc": "2.0", "id": req_id, "result": {}})
        resp['Access-Control-Allow-Origin'] = '*'
        return resp

    if method == 'tools/list':
        resp_data = {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": MCP_TOOLS
            }
        }
        resp = JsonResponse(resp_data)
        resp['Access-Control-Allow-Origin'] = '*'
        return resp

    if method == 'tools/call':
        tool_name = params.get('name')
        tool_args = params.get('arguments', {})
        
        project, _ = _authenticate_mcp_request(request, tool_args)
        if not project:
            resp_data = {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -32000,
                    "message": "Authentication required. Provide a valid Bearer API key in the Authorization header or pass api_key in arguments."
                }
            }
            resp = JsonResponse(resp_data, status=401)
            resp['Access-Control-Allow-Origin'] = '*'
            return resp

        result = _execute_mcp_tool(project, tool_name, tool_args)
        resp_data = {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": result.get("text", "")
                    }
                ],
                "isError": result.get("isError", False)
            }
        }
        resp = JsonResponse(resp_data)
        resp['Access-Control-Allow-Origin'] = '*'
        return resp

    resp = JsonResponse({"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}, status=404)
    resp['Access-Control-Allow-Origin'] = '*'
    return resp
