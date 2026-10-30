"""
Google Gemini Native Tool Calling Integration for WhatsBridge
=============================================================
Allows Google Gemini (gemini-2.5-flash / gemini-2.5-pro / gemini-1.5-pro)
to call WhatsBridge tools natively (Function Calling).
"""

import os
import json
import uuid
import requests
from typing import Dict, Any, List

BASE_URL = os.getenv("WHATSBRIDGE_BASE_URL", "https://whatsbridge-backend.onrender.com").rstrip("/")
API_KEY = os.getenv("WHATSBRIDGE_API_KEY", "")
CONNECTION_ID = os.getenv("WHATSBRIDGE_CONNECTION_ID", "")
PROJECT_ID = os.getenv("WHATSBRIDGE_PROJECT_ID", "")

# 1. Python functions that Gemini executes
def send_whatsapp_message(phone: str, text: str, connection_id: str = "") -> str:
    """Send a real WhatsApp message to an international phone number (e.g. +919567334117)."""
    conn = connection_id or CONNECTION_ID
    if not conn:
        return json.dumps({"error": "Missing connection_id"})
    
    url = f"{BASE_URL}/api/v1/messages"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "Idempotency-Key": str(uuid.uuid4())
    }
    payload = {
        "connection": conn,
        "phone": phone,
        "kind": "text",
        "payload": {"body": text}
    }
    res = requests.post(url, json=payload, headers=headers, timeout=20)
    return res.text

def send_whatsapp_otp(phone: str, ttl_seconds: int = 300) -> str:
    """Generate and deliver a secure 6-digit WhatsApp OTP verification code to a recipient phone."""
    url = f"{BASE_URL}/api/v1/otp/send" + (f"?project={PROJECT_ID}" if PROJECT_ID else "")
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "phone": phone,
        "ttl_seconds": ttl_seconds,
        "connection": CONNECTION_ID
    }
    res = requests.post(url, json=payload, headers=headers, timeout=20)
    return res.text

def verify_whatsapp_otp(challenge_id: str, code: str) -> str:
    """Verify a 6-digit WhatsApp OTP code submitted by the user."""
    url = f"{BASE_URL}/api/v1/otp/verify" + (f"?project={PROJECT_ID}" if PROJECT_ID else "")
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "challenge_id": challenge_id,
        "code": code
    }
    res = requests.post(url, json=payload, headers=headers, timeout=20)
    return res.text

# 2. Example Google Gemini Function Calling Bot
def run_gemini_whatsapp_agent(user_prompt: str, gemini_api_key: str):
    """
    Runs Google Gemini with WhatsBridge function calling tools enabled.
    """
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=gemini_api_key)
    
    # Pass tools directly to Gemini
    tools = [send_whatsapp_message, send_whatsapp_otp, verify_whatsapp_otp]

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=user_prompt,
        config=types.GenerateContentConfig(
            tools=tools,
            temperature=0.2,
            system_instruction="You are an autonomous WhatsApp assistant. When asked to message someone or send an OTP, use your WhatsBridge tools to fulfill the request."
        )
    )
    return response

if __name__ == "__main__":
    print("WhatsBridge Google Gemini Integration ready.")
    print("Available tools: send_whatsapp_message, send_whatsapp_otp, verify_whatsapp_otp")

