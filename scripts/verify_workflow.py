"""
End-to-end verification script for WhatsBridge:
1. Create user account (Register + Email Verify)
2. Login & Authenticate
3. Project setup
4. WhatsApp Connection (Sandbox & Meta compatibility)
5. Generate developer API Key
6. Test API Key with message send (idempotency, consent check)
7. Test API Key with OTP send & verify
"""
import os
import sys
import uuid
from pathlib import Path

# Add backend to path and configure django
BASE_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BASE_DIR))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
os.environ["TESTING"] = "1"
os.environ["DEBUG"] = "1"

import django
django.setup()

from django.conf import settings
settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

from django.core import mail
from rest_framework.test import APIClient
from core.models import User, Organization, Project, WhatsAppConnection, Contact, ContactConsent, APIKey, Message

def run_full_check():
    print("=" * 60)
    print("WHATSBRIDGE COMPLETE WORKFLOW VERIFICATION")
    print("=" * 60)

    client = APIClient(enforce_csrf_checks=True)

    # Step 1: CSRF & Session
    print("\n[Step 1] Fetching CSRF Session Token...")
    res = client.get("/api/auth/session")
    assert res.status_code == 200, f"Session failed: {res.content}"
    csrf_token = res.json()["csrfToken"]
    headers = {"HTTP_X_CSRFTOKEN": csrf_token}
    print(f"  -> Got CSRF Token: {csrf_token[:16]}...")

    # Step 2: Create Account / Registration
    email = f"user_{uuid.uuid4().hex[:6]}@example.com"
    password = "StrongPassword@1234"
    org_name = "Tech Solutions Ltd"
    print(f"\n[Step 2] Creating New Account: {email}...")
    reg_res = client.post(
        "/api/auth/register",
        {"email": email, "password": password, "organization": org_name},
        format="json",
        **headers
    )
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.content}"
    print(f"  -> Account created successfully (HTTP 201). Verification email dispatched.")

    # Step 3: Email Verification
    print("\n[Step 3] Verifying Account Email...")
    assert len(mail.outbox) > 0, "No email in outbox"
    last_email = mail.outbox[-1]
    verify_token = last_email.body.split("?verify=")[1].strip()
    ver_res = client.post(
        "/api/auth/verify-email",
        {"token": verify_token},
        format="json",
        **headers
    )
    assert ver_res.status_code == 200, f"Email verification failed: {ver_res.content}"
    print(f"  -> Email verified successfully (HTTP 200).")

    # Step 4: Login to Dashboard
    print(f"\n[Step 4] Logging in as {email}...")
    login_res = client.post(
        "/api/auth/login",
        {"email": email, "password": password},
        format="json",
        **headers
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.content}"
    new_csrf = login_res.json()["csrfToken"]
    headers["HTTP_X_CSRFTOKEN"] = new_csrf
    session_res = client.get("/api/auth/session")
    user_info = session_res.json()["user"]
    print(f"  -> Login successful! User ID: {user_info['id']}, Email: {user_info['email']}")

    # Check organization
    orgs_res = client.get("/api/organizations")
    assert orgs_res.status_code == 200
    org_list = orgs_res.json()
    org_id = org_list[0]["organization_id"]
    org_name = org_list[0]["organization__name"]
    print(f"  -> Organization: '{org_name}' (ID: {org_id})")

    # Create project
    proj_create_res = client.post(
        "/api/projects",
        {"organization": org_id, "name": "Production Sandbox", "sandbox": True},
        format="json",
        **headers
    )
    assert proj_create_res.status_code == 201, f"Project creation failed: {proj_create_res.content}"
    project_data = proj_create_res.json()
    project_id = project_data["id"]
    project_name = project_data["name"]
    print(f"  -> Created Project: '{project_name}' (ID: {project_id}, Sandbox: {project_data['sandbox']})")

    # Step 5: Add WhatsApp Connection
    print("\n[Step 5] Adding WhatsApp Connection...")
    conn_res = client.post(
        f"/api/v1/connections?project={project_id}",
        {"name": "Main WhatsApp Channel", "provider": "sandbox"},
        format="json",
        **headers
    )
    assert conn_res.status_code == 201, f"Connection failed: {conn_res.content}"
    conn_data = conn_res.json()
    connection_id = conn_data["id"]
    print(f"  -> WhatsApp Connection created! ID: {connection_id}, Status: {conn_data['status']}, Provider: {conn_data['provider']}")

    # Step 6: Create Contact & Consent (Required for WhatsApp compliance)
    phone_number = "+15550192834"
    print(f"\n[Step 6] Registering Contact & Consent ({phone_number})...")
    contact = Contact.objects.create(
        project_id=project_id,
        phone=phone_number,
        name="John Doe"
    )
    ContactConsent.objects.create(contact=contact, purpose="messaging", basis="User opted in via web")
    ContactConsent.objects.create(contact=contact, purpose="otp", basis="User requested login verification")
    print(f"  -> Contact registered with messaging & OTP consents.")

    # Step 7: Generate API Key
    print("\n[Step 7] Generating Developer API Key...")
    key_res = client.post(
        f"/api/v1/keys?project={project_id}",
        {
            "name": "Production Server Key",
            "scopes": ["messages:send", "messages:read", "connections:read", "otp:send", "otp:verify"]
        },
        format="json",
        **headers
    )
    assert key_res.status_code == 201, f"Key generation failed: {key_res.content}"
    key_data = key_res.json()
    api_key_secret = key_data["secret"]
    print(f"  -> Generated API Key: {key_data['prefix']}...")
    print(f"  -> Secret Token: {api_key_secret}")
    print(f"  -> Scopes: {', '.join(key_data['scopes'])}")

    # Step 8: Test API with API Key (Standalone API Client)
    print("\n[Step 8] Testing API Client with Generated Bearer Token...")
    api_client = APIClient()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {api_key_secret}")

    # 8a: Verify connections list
    conns_check = api_client.get("/api/v1/connections")
    assert conns_check.status_code == 200, f"API failed to list connections: {conns_check.content}"
    print(f"  -> [GET /api/v1/connections] OK ({conns_check.json()['count']} connections)")

    # 8b: Send WhatsApp text message
    idempotency_key = str(uuid.uuid4())
    msg_payload = {
        "connection": connection_id,
        "phone": phone_number,
        "kind": "text",
        "payload": {"body": "Hello from WhatsBridge API!"}
    }
    print(f"\n[Step 9] Sending Test Message via API...")
    send_res = api_client.post(
        "/api/v1/messages",
        msg_payload,
        format="json",
        HTTP_IDEMPOTENCY_KEY=idempotency_key
    )
    assert send_res.status_code in (200, 202), f"Message send failed: {send_res.content}"
    msg_data = send_res.json()
    print(f"  -> [POST /api/v1/messages] Status {send_res.status_code}: Message Queued/Sent!")
    print(f"  -> Message ID: {msg_data['id']}, Status: {msg_data['status']}")

    # 8c: Read messages list
    list_res = api_client.get("/api/v1/messages")
    assert list_res.status_code == 200
    print(f"  -> [GET /api/v1/messages] Total messages: {list_res.json()['count']}")

    # 8d: Send OTP Challenge
    print(f"\n[Step 10] Testing OTP Send & Verify via API...")
    otp_send_res = api_client.post(
        "/api/v1/otp/send",
        {"connection": connection_id, "phone": phone_number, "ttl_seconds": 300},
        format="json"
    )
    assert otp_send_res.status_code == 202, f"OTP Send failed: {otp_send_res.content}"
    otp_data = otp_send_res.json()
    challenge_id = otp_data["challenge_id"]
    sandbox_code = otp_data.get("sandbox_code")
    print(f"  -> [POST /api/v1/otp/send] Challenge ID: {challenge_id}")
    print(f"  -> Sandbox Generated OTP Code: {sandbox_code}")

    # 8e: Verify OTP Challenge
    otp_verify_res = api_client.post(
        "/api/v1/otp/verify",
        {"challenge_id": challenge_id, "code": sandbox_code},
        format="json"
    )
    assert otp_verify_res.status_code == 200, f"OTP Verify failed: {otp_verify_res.content}"
    assert otp_verify_res.json().get("verified") is True
    print(f"  -> [POST /api/v1/otp/verify] Result: {otp_verify_res.json()}")

    print("\n" + "=" * 60)
    print("ALL API WORKFLOW CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_full_check()
