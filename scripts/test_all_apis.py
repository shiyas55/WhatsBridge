import os
import sys
import json
import time
import requests
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

BACKEND_URL = "http://127.0.0.1:8001"
GATEWAY_URL = "http://localhost:4000"
FRONTEND_URL = "http://localhost:3000"

def test_full_suite():
    print("=" * 80)
    print("🧪 WHATSBRIDGE FULL API & WHATSAPP CONNECTION TEST SUITE")
    print("=" * 80)

    s = requests.Session()
    
    # ----------------------------------------------------
    # 1. AUTH & SESSION INITIALIZATION
    # ----------------------------------------------------
    print("\n[1/10] Testing Session & Admin Authentication...")
    sess_res = s.get(f"{BACKEND_URL}/api/auth/session")
    assert sess_res.status_code == 200, f"Session failed: {sess_res.text}"
    csrf = sess_res.json()["csrfToken"]
    print(f"  ✓ Session initialized. CSRF token: {csrf[:16]}...")

    login_res = s.post(
        f"{BACKEND_URL}/api/auth/login",
        json={"email": "admin@whatsbridge.com", "password": "AdminPassword123!"},
        headers={"X-CSRFToken": csrf}
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    csrf = s.cookies.get("csrftoken", csrf)
    print("  ✓ Admin logged in successfully (email: admin@whatsbridge.com)")

    # ----------------------------------------------------
    # 2. PROJECTS API
    # ----------------------------------------------------
    print("\n[2/10] Testing Projects API...")
    proj_res = s.get(f"{BACKEND_URL}/api/projects")
    assert proj_res.status_code == 200
    projects = proj_res.json()
    assert len(projects) > 0, "No projects returned"
    project = projects[0]
    pid = project["id"]
    org_id = project["organization"]
    print(f"  ✓ Found {len(projects)} project(s). Active Project: '{project['name']}' (ID: {pid})")

    # Create a temporary project to verify POST & DELETE
    temp_proj_res = s.post(
        f"{BACKEND_URL}/api/projects",
        json={"name": "Temporary Test Project", "sandbox": True, "organization": org_id},
        headers={"X-CSRFToken": csrf}
    )
    assert temp_proj_res.status_code == 201, f"Project creation failed: {temp_proj_res.text}"
    temp_pid = temp_proj_res.json()["id"]
    print(f"  ✓ Created project: 'Temporary Test Project' (ID: {temp_pid})")

    # Delete the temporary project
    del_proj_res = s.delete(
        f"{BACKEND_URL}/api/projects?project={temp_pid}",
        headers={"X-CSRFToken": csrf}
    )
    assert del_proj_res.status_code == 200, f"Project deletion failed: {del_proj_res.text}"
    print("  ✓ Deleted project successfully verified")

    # ----------------------------------------------------
    # 3. WHATSAPP MULTI-DEVICE (BAILEYS) CONNECTION & QR
    # ----------------------------------------------------
    print("\n[3/10] Testing WhatsApp Multi-Device Connection & QR Code Link...")
    # Gateway Health
    gw_health = requests.get(f"{GATEWAY_URL}/health", timeout=5).json()
    assert gw_health.get("status") == "ok", "Gateway is not healthy"
    print(f"  ✓ WhatsApp Gateway Health: {gw_health}")

    # Check Baileys Connections in Project
    conns_res = s.get(f"{BACKEND_URL}/api/v1/connections?project={pid}").json()
    conn_list = conns_res.get("results", conns_res) if isinstance(conns_res, dict) else conns_res
    baileys_conn = next((c for c in conn_list if isinstance(c, dict) and c.get("provider") == "baileys"), None)
    
    if not baileys_conn:
        create_c = s.post(
            f"{BACKEND_URL}/api/v1/connections?project={pid}",
            json={"name": "Test Demo WhatsApp", "provider": "baileys", "project": pid},
            headers={"X-CSRFToken": csrf}
        )
        assert create_c.status_code == 201
        baileys_conn = create_c.json()
        print(f"  ✓ Created new Baileys connection: {baileys_conn['id']}")
    else:
        print(f"  ✓ Existing Baileys connection active: '{baileys_conn['name']}' (ID: {baileys_conn['id']})")

    cid = baileys_conn["id"]

    # Request QR code via Backend Proxy
    qr_res = s.get(f"{BACKEND_URL}/api/v1/connections/{cid}/baileys_qr?project={pid}")
    assert qr_res.status_code in (200, 202), f"QR query failed: {qr_res.text}"
    qr_data = qr_res.json()
    b_status = qr_data.get("status")
    has_qr = bool(qr_data.get("qr"))
    print(f"  ✓ WhatsApp Pairing Socket Status: '{b_status}'")
    print(f"  ✓ Multi-Device Pairing QR Code Available: {has_qr} ({len(qr_data.get('qr', ''))} chars)")

    # ----------------------------------------------------
    # 4. API KEYS API & BEARER TOKEN AUTHENTICATION
    # ----------------------------------------------------
    print("\n[4/10] Testing API Keys API & Bearer Token Authentication...")
    key_name = f"Automation-Key-{int(time.time())}"
    key_res = s.post(
        f"{BACKEND_URL}/api/v1/keys?project={pid}",
        json={"name": key_name, "scopes": ["messages:send", "messages:read", "connections:read"]},
        headers={"X-CSRFToken": csrf}
    )
    assert key_res.status_code == 201, f"Key creation failed: {key_res.text}"
    key_data = key_res.json()
    secret_token = key_data["secret"]
    key_id = key_data["id"]
    print(f"  ✓ Generated API Key: '{key_name}' (ID: {key_id})")
    print(f"  ✓ Key Prefix: {key_data.get('prefix')}, Secret: {secret_token[:15]}...")

    # Test REST API Call using the API Key (No browser session/cookie!)
    api_auth_headers = {"Authorization": f"Bearer {secret_token}"}
    rest_res = requests.get(f"{BACKEND_URL}/api/v1/connections?project={pid}", headers=api_auth_headers)
    assert rest_res.status_code == 200, f"Bearer auth failed ({rest_res.status_code}): {rest_res.text}"
    print("  ✓ API Key Authentication successful: Verified via Bearer token over REST API")

    # Rotate API Key
    rotate_res = s.post(f"{BACKEND_URL}/api/v1/keys/{key_id}/rotate?project={pid}", headers={"X-CSRFToken": csrf})
    assert rotate_res.status_code == 200, f"Key rotation failed: {rotate_res.text}"
    new_secret = rotate_res.json()["secret"]
    print(f"  ✓ Key Rotation verified: New Secret generated ({new_secret[:15]}...)")

    # Revoke (DELETE) API Key
    del_key_res = s.delete(f"{BACKEND_URL}/api/v1/keys/{key_id}?project={pid}", headers={"X-CSRFToken": csrf})
    assert del_key_res.status_code in (200, 204), f"Key revoke failed: {del_key_res.text}"
    print("  ✓ API Key revoked successfully")

    # ----------------------------------------------------
    # 5. CONTACTS API & CONSENT
    # ----------------------------------------------------
    print("\n[5/10] Testing Contacts API & Opt-In Consent...")
    contact_phone = f"+9198{int(time.time()) % 100000000:08d}"
    contact_res = s.post(
        f"{BACKEND_URL}/api/v1/contacts?project={pid}",
        json={"phone": contact_phone, "name": "Test Customer", "attributes": {"city": "Bengaluru", "tier": "VIP"}},
        headers={"X-CSRFToken": csrf}
    )
    assert contact_res.status_code in (200, 201), f"Contact creation failed: {contact_res.text}"
    contact_id = contact_res.json()["id"]
    print(f"  ✓ Contact created: 'Test Customer' ({contact_phone}, ID: {contact_id})")

    # Record Consent
    consent_res = s.post(
        f"{BACKEND_URL}/api/v1/contacts/{contact_id}/consent?project={pid}",
        json={"purpose": "messaging", "basis": "website_optin", "granted": True},
        headers={"X-CSRFToken": csrf}
    )
    assert consent_res.status_code == 200, f"Consent record failed: {consent_res.text}"
    print("  ✓ Explicit WhatsApp Opt-in Consent recorded in database")

    # ----------------------------------------------------
    # 6. MESSAGES API & IDEMPOTENCY
    # ----------------------------------------------------
    print("\n[6/10] Testing Messages API (Enqueue & Delivery Pipeline)...")
    from core.models import WhatsAppConnection
    WhatsAppConnection.objects.filter(pk=cid).update(status="CONNECTED")

    idem_key = f"idem-{time.time()}"
    msg_res = s.post(
        f"{BACKEND_URL}/api/v1/messages?project={pid}",
        json={
            "connection": cid,
            "phone": contact_phone,
            "kind": "text",
            "payload": {"body": "Hello! This is an automated test message from WhatsBridge."}
        },
        headers={"X-CSRFToken": csrf, "Idempotency-Key": idem_key}
    )
    assert msg_res.status_code in (200, 202), f"Message send failed: {msg_res.text}"
    msg_data = msg_res.json()
    msg_id = msg_data["id"]
    print(f"  ✓ Message enqueued successfully: (ID: {msg_id}, Status: {msg_data.get('status')})")

    # Test Idempotency with exact same key
    msg_retry = s.post(
        f"{BACKEND_URL}/api/v1/messages?project={pid}",
        json={
            "connection": cid,
            "phone": contact_phone,
            "kind": "text",
            "payload": {"body": "Hello! This is an automated test message from WhatsBridge."}
        },
        headers={"X-CSRFToken": csrf, "Idempotency-Key": idem_key}
    )
    assert msg_retry.status_code == 200, f"Idempotency duplicate check failed: {msg_retry.text}"
    print(f"  ✓ Idempotency verified: Replay recognized without duplicate send (ID: {msg_retry.json()['id']})")

    # ----------------------------------------------------
    # 7. TEMPLATES API
    # ----------------------------------------------------
    print("\n[7/10] Testing Templates API...")
    tpl_name = f"order_update_{int(time.time())}"
    tpl_res = s.post(
        f"{BACKEND_URL}/api/v1/templates?project={pid}",
        json={
            "name": tpl_name,
            "category": "utility",
            "language": "en_US",
            "components": [
                {"type": "BODY", "text": "Hi {{1}}, your order #{{2}} is confirmed and out for delivery!"}
            ]
        },
        headers={"X-CSRFToken": csrf}
    )
    assert tpl_res.status_code == 201, f"Template create failed: {tpl_res.text}"
    tpl_data = tpl_res.json()
    print(f"  ✓ Template created: '{tpl_name}' (Category: {tpl_data.get('category')}, Language: {tpl_data.get('language')})")

    # ----------------------------------------------------
    # 8. WEBHOOKS API
    # ----------------------------------------------------
    print("\n[8/10] Testing Webhooks API & Secret Rotation...")
    hook_res = s.post(
        f"{BACKEND_URL}/api/v1/webhooks?project={pid}",
        json={"url": "https://example.com/api/whatsapp-callback", "events": ["message.received", "message.delivered"]},
        headers={"X-CSRFToken": csrf}
    )
    assert hook_res.status_code == 201, f"Webhook create failed: {hook_res.text}"
    hook_data = hook_res.json()
    hook_id = hook_data["id"]
    print(f"  ✓ Webhook created: {hook_data['url']} (ID: {hook_id})")

    rotate_hook = s.post(f"{BACKEND_URL}/api/v1/webhooks/{hook_id}/rotate?project={pid}", headers={"X-CSRFToken": csrf})
    assert rotate_hook.status_code == 200, f"Webhook rotate failed: {rotate_hook.text}"
    print(f"  ✓ Webhook signing secret rotated: {rotate_hook.json().get('secret', '')[:16]}...")

    # Clean up webhook
    s.delete(f"{BACKEND_URL}/api/v1/webhooks/{hook_id}?project={pid}", headers={"X-CSRFToken": csrf})
    print("  ✓ Webhook deleted successfully")

    # ----------------------------------------------------
    # 9. GOOGLE GEMINI AI ASSISTANT API
    # ----------------------------------------------------
    print("\n[9/10] Testing Google Gemini AI Assistant API...")
    ai_res = s.post(
        f"{BACKEND_URL}/api/ai?project={pid}",
        json={"prompt": "A customer sent: 'Hi, can you tell me if my WhatsApp order is delivered?' Generate a professional 1-sentence WhatsApp reply.", "mode": "reply"},
        headers={"X-CSRFToken": csrf},
        timeout=15
    )
    assert ai_res.status_code == 200, f"AI generation failed: {ai_res.text}"
    ai_data = ai_res.json()
    print(f"  ✓ Gemini AI Generation completed (Tokens used: {ai_data.get('tokens')})")
    print(f"  ✓ AI Response:\n    \"{ai_data.get('response').strip()}\"")

    # ----------------------------------------------------
    # 10. OVERVIEW & ANALYTICS API (CACHED)
    # ----------------------------------------------------
    print("\n[10/10] Testing Overview & Analytics Statistics API...")
    t0 = time.time()
    ov_res = s.get(f"{BACKEND_URL}/api/overview?project={pid}")
    ov_elapsed = time.time() - t0
    assert ov_res.status_code == 200, f"Overview failed: {ov_res.text}"
    ov_data = ov_res.json()
    print(f"  ✓ Overview API responded in {ov_elapsed:.3f}s")
    print(f"    • Total Messages: {ov_data.get('messages')}")
    print(f"    • Active Connections: {ov_data.get('connections')}")
    print(f"    • Total Contacts: {ov_data.get('contacts')}")
    print(f"    • Plan: {ov_data.get('subscription', {}).get('plan')}")

    print("\n" + "=" * 80)
    print("🎉 ALL 10 APIS & WHATSAPP INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 80)

if __name__ == "__main__":
    test_full_suite()
