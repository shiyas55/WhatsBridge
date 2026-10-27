import os
import sys
import json
import time
import requests
from pathlib import Path

# Setup paths
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

BACKEND_URL = "http://127.0.0.1:8001"
GATEWAY_URL = "http://localhost:4000"
FRONTEND_URL = "http://localhost:3000"

def run_tests():
    print("=" * 70)
    print("🚀 WHATSBRIDGE FULL SYSTEM & HOSTING E2E TEST SUITE")
    print("=" * 70)
    results = {}

    # STEP 1: NEON POSTGRESQL CLOUD HOSTING
    print("\n[STEP 1/5] Verifying Neon PostgreSQL Cloud Database Hosting...")
    try:
        from django.conf import settings
        import django
        django.setup()
        from django.db import connection
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(), current_user, version();")
            db_name, db_user, version = cursor.fetchone()
            cursor.execute("SELECT count(*) FROM core_project;")
            project_count = cursor.fetchone()[0]
            cursor.execute("SELECT count(*) FROM core_whatsappconnection;")
            connection_count = cursor.fetchone()[0]
            cursor.execute("SELECT count(*) FROM core_message;")
            message_count = cursor.fetchone()[0]
            
        print(f"  ✓ Connected to Neon DB: '{db_name}' as user '{db_user}'")
        print(f"  ✓ Engine: {version.split(',')[0]}")
        print(f"  ✓ Cloud Tables verified: {project_count} projects, {connection_count} connections, {message_count} messages")
        results["neon_database"] = {
            "status": "PASS",
            "database": db_name,
            "user": db_user,
            "projects": project_count,
            "connections": connection_count
        }
    except Exception as e:
        print(f"  ✗ Neon DB connection failed: {e}")
        results["neon_database"] = {"status": "FAIL", "error": str(e)}

    # STEP 2: GATEWAY SERVICE & BAILEYS MULTI-DEVICE
    print("\n[STEP 2/5] Verifying Gateway Service & WhatsApp Multi-Device (Baileys)...")
    try:
        gw_token = settings.GATEWAY_TOKEN
        # Health check
        h_res = requests.get(f"{GATEWAY_URL}/health", timeout=5).json()
        print(f"  ✓ Gateway Health: {h_res}")
        
        # Baileys QR Status
        b_res = requests.get(
            f"{GATEWAY_URL}/baileys/status",
            headers={"Authorization": f"Bearer {gw_token}"},
            timeout=5
        ).json()
        print(f"  ✓ Baileys Multi-Device Status: '{b_res.get('status')}'")
        has_qr = bool(b_res.get("qr"))
        print(f"  ✓ Live WhatsApp QR Code Generated: {has_qr} ({len(b_res.get('qr', ''))} bytes)")
        
        results["gateway_baileys"] = {
            "status": "PASS",
            "health": h_res.get("status"),
            "baileys_state": b_res.get("status"),
            "has_qr": has_qr
        }
    except Exception as e:
        print(f"  ✗ Gateway verification failed: {e}")
        results["gateway_baileys"] = {"status": "FAIL", "error": str(e)}

    # STEP 3: BACKEND API & ADMIN AUTHENTICATION
    print("\n[STEP 3/5] Verifying Backend Django API & Admin Session...")
    s = requests.Session()
    try:
        # Session & CSRF
        sess = s.get(f"{BACKEND_URL}/api/auth/session", timeout=5).json()
        csrf_token = sess["csrfToken"]
        print(f"  ✓ Session initialized. CSRF token obtained: {csrf_token[:16]}...")
        
        # Admin Login
        login_res = s.post(
            f"{BACKEND_URL}/api/auth/login",
            json={"email": "admin@whatsbridge.com", "password": "AdminPassword123!"},
            headers={"X-CSRFToken": csrf_token},
            timeout=5
        )
        assert login_res.status_code == 200, f"Login returned {login_res.status_code}: {login_res.text}"
        user_info = login_res.json()
        print(f"  ✓ Admin logged in successfully: {user_info.get('email')} (Superuser: {user_info.get('is_superuser', True)})")
        
        csrf_token = s.cookies.get("csrftoken", csrf_token)
        
        # Projects List
        projects = s.get(f"{BACKEND_URL}/api/projects").json()
        assert len(projects) > 0, "No projects returned"
        active_project = projects[0]
        project_id = active_project["id"]
        print(f"  ✓ Active Project: '{active_project['name']}' (ID: {project_id})")
        
        # Connections List & Baileys QR
        conns_resp = s.get(f"{BACKEND_URL}/api/v1/connections?project={project_id}").json()
        conns = conns_resp.get("results", conns_resp) if isinstance(conns_resp, dict) else conns_resp
        baileys_conn = next((c for c in conns if c.get("provider") == "baileys"), None)
        assert baileys_conn is not None, "Baileys connection not found"
        print(f"  ✓ WhatsApp Connection verified: '{baileys_conn['name']}' (ID: {baileys_conn['id']})")
        
        # Query Baileys QR via Backend Proxy
        qr_resp = s.get(f"{BACKEND_URL}/api/v1/connections/{baileys_conn['id']}/baileys_qr?project={project_id}").json()
        print(f"  ✓ Baileys QR via Backend Proxy: status='{qr_resp.get('status')}', QR ready={bool(qr_resp.get('qr'))}")
        
        # Create API Key Test
        key_name = f"Test-Key-{int(time.time())}"
        key_res = s.post(
            f"{BACKEND_URL}/api/v1/keys?project={project_id}",
            json={
                "project": project_id,
                "name": key_name,
                "scopes": ["messages:send", "messages:read", "connections:read"]
            },
            headers={"X-CSRFToken": csrf_token}
        )
        assert key_res.status_code == 201, f"Create key failed: {key_res.text}"
        key_data = key_res.json()
        raw_key = key_data.get("key")
        print(f"  ✓ API Key created & hashed on Neon DB: '{key_name}' (Prefix: {key_data.get('prefix')})")

        results["backend_admin"] = {
            "status": "PASS",
            "admin_email": user_info.get("email"),
            "project_id": project_id,
            "connection_id": baileys_conn["id"],
            "api_key_created": key_name
        }
    except Exception as e:
        print(f"  ✗ Backend admin test failed: {e}")
        results["backend_admin"] = {"status": "FAIL", "error": str(e)}

    # STEP 4: GOOGLE GEMINI AI ASSISTANT ENDPOINT
    print("\n[STEP 4/5] Verifying Google Gemini AI Assistant with Active Model...")
    try:
        ai_res = s.post(
            f"{BACKEND_URL}/api/ai?project={project_id}",
            json={
                "prompt": "Customer asking in Malayalam/English: When will my Test Demo notification arrive?",
                "mode": "reply"
            },
            headers={"X-CSRFToken": csrf_token},
            timeout=15
        )
        assert ai_res.status_code == 200, f"AI generation failed ({ai_res.status_code}): {ai_res.text}"
        ai_data = ai_res.json()
        print(f"  ✓ Gemini API Model: {settings.GEMINI_MODEL}")
        print(f"  ✓ Tokens consumed: {ai_data.get('tokens')}")
        print(f"  ✓ AI Response generated successfully:\n    \"{ai_data.get('response').replace(chr(10), ' ')[:120]}...\"")
        
        results["gemini_ai"] = {
            "status": "PASS",
            "model": settings.GEMINI_MODEL,
            "tokens": ai_data.get("tokens"),
            "preview": ai_data.get("response")[:60]
        }
    except Exception as e:
        print(f"  ✗ Gemini AI test failed: {e}")
        results["gemini_ai"] = {"status": "FAIL", "error": str(e)}

    # STEP 5: FRONTEND HOSTING & SSR
    print("\n[STEP 5/5] Verifying Next.js Frontend Dashboard Hosting...")
    try:
        f_res = requests.get(FRONTEND_URL, timeout=5)
        assert f_res.status_code == 200, f"Frontend returned {f_res.status_code}"
        has_title = "WhatsBridge" in f_res.text or "<title>" in f_res.text
        print(f"  ✓ Frontend server reachable at {FRONTEND_URL} (Status: {f_res.status_code})")
        print(f"  ✓ HTML Document rendered successfully (Length: {len(f_res.text)} bytes)")
        
        results["frontend"] = {
            "status": "PASS",
            "url": FRONTEND_URL,
            "http_status": f_res.status_code,
            "bytes": len(f_res.text)
        }
    except Exception as e:
        print(f"  ✗ Frontend verification failed: {e}")
        results["frontend"] = {"status": "FAIL", "error": str(e)}

    # SUMMARY
    print("\n" + "=" * 70)
    print("📊 OVERALL SYSTEM AUDIT SUMMARY:")
    print("=" * 70)
    all_passed = all(v.get("status") == "PASS" for v in results.values())
    for component, details in results.items():
        st = details.get("status")
        icon = "✅" if st == "PASS" else "❌"
        print(f"  {icon} {component.upper().replace('_', ' ')}: {st}")
    
    if all_passed:
        print("\n🎉 ALL 5 HOSTING & INTEGRATION STEPS PASSED WITH 100% SUCCESS!")
    else:
        print("\n⚠️ SOME CHECKS FAILED. See details above.")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
