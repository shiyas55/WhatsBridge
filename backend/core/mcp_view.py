from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.conf import settings
from django.http import JsonResponse
import json

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
