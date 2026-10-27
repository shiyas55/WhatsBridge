#!/usr/bin/env python3
"""
Test creating another user account, creating their isolated WhatsApp connection,
and testing it with both Session authentication and API Key (Bearer token).
Verifies strict multi-tenant isolation:
1. New user can ONLY see and get their own WhatsApp connection.
2. New user is BLOCKED (403) from accessing admin's project or connections.
3. API key for new user automatically scopes to their project and returns only their WhatsApp.
4. Admin cannot see new user's connection.
"""

import os
import sys
import time
import requests
import django

# Setup Django environment
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from core.models import User, Organization, Project, WhatsAppConnection

BACKEND_URL = "http://127.0.0.1:8001"

def print_header(title):
    print("\n" + "=" * 80)
    print(f"🔒 {title}")
    print("=" * 80)

def main():
    print_header("MULTI-TENANT TEST: OTHER PERSON ACCOUNT & WHATSAPP API ISOLATION")

    other_email = f"user_{int(time.time())}@otherbusiness.com"
    other_pw = "SecureOtherPersonPassword123!"
    other_org_name = "Other Person Retail Enterprise"

    # =========================================================================
    # STEP 1: CREATE NEW PERSON ACCOUNT VIA API (/api/auth/register)
    # =========================================================================
    print(f"\n[1/7] Registering new user account: {other_email}...")
    s_other = requests.Session()
    
    # Get initial CSRF token
    csrf_res = s_other.get(f"{BACKEND_URL}/api/auth/session")
    csrf_token = csrf_res.cookies.get("csrftoken") or s_other.cookies.get("csrftoken")

    reg_res = s_other.post(
        f"{BACKEND_URL}/api/auth/register",
        json={
            "email": other_email,
            "password": other_pw,
            "organization": other_org_name,
        },
        headers={"X-CSRFToken": csrf_token}
    )
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
    print(f"  ✓ Account registered successfully. Response: {reg_res.json()}")

    # Verify email in database for test purposes
    User.objects.filter(email=other_email).update(email_verified=True)
    print("  ✓ Account email verified")

    # =========================================================================
    # STEP 2: LOG IN AS NEW PERSON
    # =========================================================================
    print(f"\n[2/7] Logging in as new user: {other_email}...")
    login_res = s_other.post(
        f"{BACKEND_URL}/api/auth/login",
        json={"email": other_email, "password": other_pw},
        headers={"X-CSRFToken": csrf_token}
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    csrf_other = s_other.cookies.get("csrftoken")
    print(f"  ✓ Logged in. New user session active (CSRF: {csrf_other[:12]}...)")

    # Check organizations for new user
    org_res = s_other.get(f"{BACKEND_URL}/api/organizations")
    assert org_res.status_code == 200, f"Get orgs failed: {org_res.text}"
    orgs = org_res.json()
    assert len(orgs) == 1, f"Expected 1 organization, got {len(orgs)}"
    other_org_id = str(orgs[0]["organization_id"])
    print(f"  ✓ User belongs strictly to their own organization: '{orgs[0]['organization__name']}' (ID: {other_org_id})")

    # =========================================================================
    # STEP 3: CREATE PROJECT FOR NEW USER
    # =========================================================================
    print(f"\n[3/7] Creating Project for new user...")
    proj_create = s_other.post(
        f"{BACKEND_URL}/api/projects",
        json={
            "name": "Other Person WhatsApp Automation",
            "organization": other_org_id,
            "sandbox": True
        },
        headers={"X-CSRFToken": csrf_other}
    )
    assert proj_create.status_code == 201, f"Project creation failed: {proj_create.text}"
    other_project = proj_create.json()
    other_pid = other_project["id"]
    print(f"  ✓ Project created: '{other_project['name']}' (ID: {other_pid})")

    # =========================================================================
    # STEP 4: VERIFY CROSS-TENANT ISOLATION (CANNOT ACCESS ADMIN PROJECT)
    # =========================================================================
    print(f"\n[4/7] Testing Security Boundary: Attempting to query Admin's projects/connections...")
    admin_user = User.objects.filter(email="admin@whatsbridge.com").first()
    admin_project = Project.objects.filter(organization__organizationmembership__user=admin_user).first()
    admin_pid = str(admin_project.id)

    # Attempt to access Admin's project connections using new user session
    leak_attempt = s_other.get(f"{BACKEND_URL}/api/v1/connections?project={admin_pid}")
    assert leak_attempt.status_code in (403, 404), f"Security breach! Expected 403, got {leak_attempt.status_code}: {leak_attempt.text}"
    print(f"  🔒 BLOCKED: Access to Admin project ({admin_pid}) was rejected ({leak_attempt.status_code} Forbidden)")

    # =========================================================================
    # STEP 5: CREATE & GET WHATSAPP CONNECTION FOR NEW PERSON
    # =========================================================================
    print(f"\n[5/7] Creating WhatsApp Connection for new user...")
    conn_create = s_other.post(
        f"{BACKEND_URL}/api/v1/connections?project={other_pid}",
        json={
            "provider": "baileys",
            "name": "Other Person Direct WhatsApp"
        },
        headers={"X-CSRFToken": csrf_other}
    )
    assert conn_create.status_code == 201, f"Connection creation failed: {conn_create.text}"
    other_conn = conn_create.json()
    other_cid = other_conn["id"]
    print(f"  ✓ Connection created: '{other_conn['name']}' (ID: {other_cid}, Provider: {other_conn['provider']})")

    # Query connections for this person
    conns_res = s_other.get(f"{BACKEND_URL}/api/v1/connections?project={other_pid}")
    assert conns_res.status_code == 200, f"List connections failed: {conns_res.text}"
    conns_data = conns_res.json()
    conns = conns_data.get("results", conns_data) if isinstance(conns_data, dict) else conns_data
    print(f"  ✓ Retrieved connections for new user: {len(conns)} connection(s)")
    for c in conns:
        print(f"    • ID: {c['id']}, Name: {c['name']}, Provider: {c['provider']}, Status: {c['status']}")
    
    # Assert they only see THEIR connection
    assert len(conns) == 1, f"Expected exactly 1 connection, got {len(conns)}"
    assert conns[0]["id"] == other_cid, "Returned connection ID mismatch!"
    assert conns[0]["name"] == "Other Person Direct WhatsApp", "Connection name mismatch!"

    # Get WhatsApp Pairing Link & QR for new person
    qr_res = s_other.get(f"{BACKEND_URL}/api/v1/connections/{other_cid}/baileys_qr?project={other_pid}")
    assert qr_res.status_code == 200, f"Baileys QR failed: {qr_res.text}"
    qr_data = qr_res.json()
    print(f"  ✓ WhatsApp Link Status for new person: {qr_data.get('status')}")
    print(f"  ✓ Pairing QR String Length: {len(qr_data.get('qr', ''))} characters")

    # =========================================================================
    # STEP 6: CREATE API KEY & TEST ACCESS VIA REST API (BEARER TOKEN)
    # =========================================================================
    print(f"\n[6/7] Creating API Key for new user and testing standalone REST API access...")
    key_res = s_other.post(
        f"{BACKEND_URL}/api/v1/keys?project={other_pid}",
        json={
            "name": "OtherPerson-Production-Key",
            "scopes": ["messages:send", "messages:read", "connections:read"]
        },
        headers={"X-CSRFToken": csrf_other}
    )
    assert key_res.status_code == 201, f"API Key creation failed: {key_res.text}"
    key_data = key_res.json()
    api_secret = key_data["secret"]
    key_prefix = key_data["prefix"]
    print(f"  ✓ API Key created for new user: Prefix: {key_prefix}, Secret: {api_secret[:14]}...")

    # Query /api/v1/connections using pure Bearer token (no cookies/session)
    api_client = requests.Session()
    api_conns_res = api_client.get(
        f"{BACKEND_URL}/api/v1/connections",
        headers={"Authorization": f"Bearer {api_secret}"}
    )
    assert api_conns_res.status_code == 200, f"Bearer token query failed: {api_conns_res.text}"
    api_conns_data = api_conns_res.json()
    api_conns = api_conns_data.get("results", api_conns_data) if isinstance(api_conns_data, dict) else api_conns_data
    print(f"  ✓ Bearer token query successful: returned {len(api_conns)} connection(s)")
    assert len(api_conns) == 1, "API Key returned wrong number of connections!"
    assert api_conns[0]["id"] == other_cid, "API Key did not return new person's connection!"
    print(f"  ✓ STRICT ISOLATION PROVED: Bearer token automatically scoped to new person's WhatsApp connection:")
    print(f"    • ID: {api_conns[0]['id']}")
    print(f"    • Name: {api_conns[0]['name']}")
    print(f"    • Status: {api_conns[0]['status']}")

    # Try to access Admin's project with new user's API Key
    tamper_attempt = api_client.get(
        f"{BACKEND_URL}/api/v1/connections?project={admin_pid}",
        headers={"Authorization": f"Bearer {api_secret}"}
    )
    assert tamper_attempt.status_code == 403, f"Expected 403 Project mismatch, got {tamper_attempt.status_code}"
    print(f"  🔒 BLOCKED: API Key rejected tamper request for other project ({tamper_attempt.json().get('detail')})")

    # =========================================================================
    # STEP 7: VERIFY ADMIN CANNOT SEE NEW USER'S WHATSAPP CONNECTION
    # =========================================================================
    print(f"\n[7/7] Verifying Admin cannot see new user's WhatsApp connection...")
    s_admin = requests.Session()
    admin_csrf_res = s_admin.get(f"{BACKEND_URL}/api/auth/session")
    admin_csrf = admin_csrf_res.cookies.get("csrftoken") or s_admin.cookies.get("csrftoken")

    admin_login = s_admin.post(
        f"{BACKEND_URL}/api/auth/login",
        json={"email": "admin@whatsbridge.com", "password": "AdminPassword123!"},
        headers={"X-CSRFToken": admin_csrf}
    )
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
    admin_csrf = s_admin.cookies.get("csrftoken")

    admin_conns_res = s_admin.get(f"{BACKEND_URL}/api/v1/connections?project={admin_pid}")
    assert admin_conns_res.status_code == 200
    admin_conns_data = admin_conns_res.json()
    admin_conns = admin_conns_data.get("results", admin_conns_data) if isinstance(admin_conns_data, dict) else admin_conns_data
    admin_conn_ids = [c["id"] for c in admin_conns]

    assert other_cid not in admin_conn_ids, "Admin can see new user's WhatsApp connection! Isolation breached!"
    print(f"  ✓ Admin connections list ({len(admin_conns)} connections) DOES NOT contain new person's connection ID")
    print(f"  ✓ Total Admin connections: {len(admin_conns)}")
    for ac in admin_conns:
        print(f"    • Admin Connection: '{ac['name']}' ({ac['id']})")

    print("\n" + "=" * 80)
    print("🎉 MULTI-TENANT ISOLATION FULLY VERIFIED!")
    print("   1. New account created & authenticated independently.")
    print("   2. New person's WhatsApp connection retrieved via API.")
    print("   3. Bearer Token API Key authenticated and strictly scoped to new person only.")
    print("   4. Full isolation confirmed between accounts (Neither can access the other's WhatsApp).")
    print("=" * 80)

if __name__ == "__main__":
    main()
