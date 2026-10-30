#!/usr/bin/env python3
"""
WhatsBridge Model Context Protocol (MCP) Server
===============================================
Exposes WhatsBridge WhatsApp Messaging, OTP Verification, Contacts,
and Connection Management tools to AI models and agents:
- Claude Desktop
- ChatGPT / OpenAI Actions / Custom GPTs
- Cursor IDE / Windsurf / Antigravity
- LangChain, LlamaIndex, CrewAI, AutoGen

Protocol: Model Context Protocol (MCP) Standard stdio & streamable HTTP/SSE.
"""

import os
import sys
import json
import uuid
import httpx2
from typing import Optional, List, Dict, Any
from mcp.server.mcpserver import MCPServer

# Configuration from environment variables
DEFAULT_BASE_URL = os.getenv("WHATSBRIDGE_BASE_URL", "https://whatsbridge-backend.onrender.com").rstrip("/")
DEFAULT_API_KEY = os.getenv("WHATSBRIDGE_API_KEY", "")
DEFAULT_CONNECTION_ID = os.getenv("WHATSBRIDGE_CONNECTION_ID", "")
DEFAULT_PROJECT_ID = os.getenv("WHATSBRIDGE_PROJECT_ID", "")

# Initialize MCP Server
mcp = MCPServer(
    name="whatsbridge",
    instructions="WhatsBridge MCP Server - Send WhatsApp messages, dispatch OTPs, verify challenges, and manage messaging via WhatsApp Web & Meta Cloud API."
)

def _get_headers(api_key: Optional[str] = None) -> Dict[str, str]:
    key = (api_key or DEFAULT_API_KEY).strip()
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return headers

def _resolve_base_url(base_url: Optional[str] = None) -> str:
    url = (base_url or DEFAULT_BASE_URL).strip().rstrip("/")
    return url

@mcp.tool(
    name="send_whatsapp_message",
    description="Send a real WhatsApp message (text) to any phone number in international E.164 format (e.g. +919567334117)."
)
async def send_whatsapp_message(
    phone: str,
    text: str,
    connection_id: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> str:
    """
    Sends a WhatsApp text message through WhatsBridge.
    
    Args:
        phone: Recipient phone number in E.164 format (e.g., +919567334117 or +15551234567).
        text: The text content of the WhatsApp message.
        connection_id: Optional UUID of the WhatsApp connection. If omitted, uses WHATSBRIDGE_CONNECTION_ID.
        api_key: Optional WhatsBridge API Key (wb_live_... or wb_test_...). If omitted, uses WHATSBRIDGE_API_KEY.
        base_url: Optional base URL of the WhatsBridge backend. Defaults to production.
    """
    conn = connection_id or DEFAULT_CONNECTION_ID
    if not conn:
        return json.dumps({
            "error": "Missing connection_id. Pass connection_id or set WHATSBRIDGE_CONNECTION_ID environment variable."
        })
    
    url = f"{_resolve_base_url(base_url)}/api/v1/messages"
    headers = _get_headers(api_key)
    headers["Idempotency-Key"] = str(uuid.uuid4())
    
    payload = {
        "connection": conn,
        "phone": phone.strip(),
        "kind": "text",
        "payload": {"body": text}
    }
    
    try:
        async with httpx2.AsyncClient(timeout=25.0) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code in (200, 201, 202):
                data = res.json()
                return json.dumps({
                    "success": True,
                    "message_id": data.get("id"),
                    "status": data.get("status", "queued"),
                    "phone": phone,
                    "detail": "WhatsApp message queued for delivery successfully."
                }, indent=2)
            else:
                return json.dumps({
                    "success": False,
                    "status_code": res.status_code,
                    "error": res.text
                }, indent=2)
    except Exception as exc:
        return json.dumps({"success": False, "error": str(exc)}, indent=2)

@mcp.tool(
    name="send_whatsapp_otp",
    description="Generate and deliver a secure 6-digit WhatsApp OTP verification code to a recipient phone."
)
async def send_whatsapp_otp(
    phone: str,
    project_id: Optional[str] = None,
    connection_id: Optional[str] = None,
    ttl_seconds: int = 300,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> str:
    """
    Dispatches a 6-digit OTP code to the recipient's WhatsApp.
    
    Args:
        phone: Recipient phone number in E.164 format (e.g. +919567334117).
        project_id: Optional project UUID. If omitted, uses WHATSBRIDGE_PROJECT_ID.
        connection_id: Optional specific WhatsApp connection UUID.
        ttl_seconds: Code validity duration in seconds (60-600, default: 300 / 5 mins).
        api_key: Optional WhatsBridge API Key.
        base_url: Optional backend URL.
    """
    proj = project_id or DEFAULT_PROJECT_ID
    query_param = f"?project={proj}" if proj else ""
    url = f"{_resolve_base_url(base_url)}/api/v1/otp/send{query_param}"
    headers = _get_headers(api_key)
    
    payload = {
        "phone": phone.strip(),
        "ttl_seconds": ttl_seconds,
    }
    if proj:
        payload["project"] = proj
    if connection_id or DEFAULT_CONNECTION_ID:
        payload["connection"] = connection_id or DEFAULT_CONNECTION_ID
        
    try:
        async with httpx2.AsyncClient(timeout=25.0) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code in (200, 201, 202):
                data = res.json()
                return json.dumps({
                    "success": True,
                    "challenge_id": data.get("challenge_id"),
                    "expires_at": data.get("expires_at"),
                    "status": data.get("status", "queued"),
                    "phone": data.get("phone", phone),
                    "sandbox_code": data.get("sandbox_code"),
                    "detail": "OTP challenge created. Deliver code to user and verify with verify_whatsapp_otp."
                }, indent=2)
            else:
                return json.dumps({
                    "success": False,
                    "status_code": res.status_code,
                    "error": res.text
                }, indent=2)
    except Exception as exc:
        return json.dumps({"success": False, "error": str(exc)}, indent=2)

@mcp.tool(
    name="verify_whatsapp_otp",
    description="Verify the 6-digit WhatsApp OTP code submitted by the user against an active challenge ID."
)
async def verify_whatsapp_otp(
    challenge_id: str,
    code: str,
    project_id: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> str:
    """
    Validates a 6-digit OTP code against the challenge.
    
    Args:
        challenge_id: UUID of the challenge returned by send_whatsapp_otp.
        code: 6-digit code entered by the user (e.g., '123456').
        project_id: Optional project UUID.
        api_key: Optional API key.
        base_url: Optional backend URL.
    """
    proj = project_id or DEFAULT_PROJECT_ID
    query_param = f"?project={proj}" if proj else ""
    url = f"{_resolve_base_url(base_url)}/api/v1/otp/verify{query_param}"
    headers = _get_headers(api_key)
    
    payload = {
        "challenge_id": challenge_id.strip(),
        "code": code.strip()
    }
    if proj:
        payload["project"] = proj
        
    try:
        async with httpx2.AsyncClient(timeout=25.0) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code == 200:
                data = res.json()
                return json.dumps({
                    "success": True,
                    "verified": True,
                    "verification_token": data.get("verification_token"),
                    "expires_in": data.get("expires_in", 300),
                    "detail": "Phone successfully verified! Signed proof token issued."
                }, indent=2)
            else:
                return json.dumps({
                    "success": False,
                    "verified": False,
                    "status_code": res.status_code,
                    "error": res.text
                }, indent=2)
    except Exception as exc:
        return json.dumps({"success": False, "error": str(exc)}, indent=2)

@mcp.tool(
    name="list_whatsapp_connections",
    description="List all available WhatsApp transport connections and their live connection status (CONNECTED, PAIRING, DISCONNECTED)."
)
async def list_whatsapp_connections(
    project_id: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> str:
    """
    Retrieves the list of active WhatsApp connections in the project.
    """
    proj = project_id or DEFAULT_PROJECT_ID
    query_param = f"?project={proj}" if proj else ""
    url = f"{_resolve_base_url(base_url)}/api/v1/connections{query_param}"
    headers = _get_headers(api_key)
    
    try:
        async with httpx2.AsyncClient(timeout=20.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                conns = res.json()
                return json.dumps({"success": True, "connections": conns}, indent=2)
            else:
                return json.dumps({"success": False, "status_code": res.status_code, "error": res.text}, indent=2)
    except Exception as exc:
        return json.dumps({"success": False, "error": str(exc)}, indent=2)

@mcp.tool(
    name="send_bulk_whatsapp_broadcast",
    description="Broadcast a WhatsApp text message to multiple recipients with built-in pacing to protect from anti-spam rate limits."
)
async def send_bulk_whatsapp_broadcast(
    phones: List[str],
    body: str,
    connection_id: Optional[str] = None,
    project_id: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> str:
    """
    Broadcasts message to an array of phone numbers.
    """
    conn = connection_id or DEFAULT_CONNECTION_ID
    proj = project_id or DEFAULT_PROJECT_ID
    query_param = f"?project={proj}" if proj else ""
    url = f"{_resolve_base_url(base_url)}/api/v1/messages/bulk{query_param}"
    headers = _get_headers(api_key)
    
    payload = {
        "phones": "\n".join(phones) if isinstance(phones, list) else str(phones),
        "body": body,
    }
    if conn:
        payload["connection"] = conn
    if proj:
        payload["project"] = proj
        
    try:
        async with httpx2.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code in (200, 201, 202):
                data = res.json()
                return json.dumps({
                    "success": True,
                    "total_queued": data.get("total", len(phones)),
                    "detail": "Bulk broadcast enqueued and dispatching with safe pacing."
                }, indent=2)
            else:
                return json.dumps({"success": False, "status_code": res.status_code, "error": res.text}, indent=2)
    except Exception as exc:
        return json.dumps({"success": False, "error": str(exc)}, indent=2)

@mcp.tool(
    name="get_whatsbridge_health",
    description="Check the live status and connectivity of the WhatsBridge backend, Neon database, and cache."
)
async def get_whatsbridge_health(base_url: Optional[str] = None) -> str:
    """
    Checks WhatsBridge service health.
    """
    url = f"{_resolve_base_url(base_url)}/health"
    try:
        async with httpx2.AsyncClient(timeout=10.0) as client:
            res = await client.get(url)
            return json.dumps({
                "status_code": res.status_code,
                "health": res.json() if res.status_code == 200 else res.text
            }, indent=2)
    except Exception as exc:
        return json.dumps({"error": str(exc)}, indent=2)

def main():
    """Runs the MCP server over standard I/O (stdio)."""
    mcp.run()

if __name__ == "__main__":
    main()

