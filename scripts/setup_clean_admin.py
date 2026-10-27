"""
Clean up all sandbox connected WhatsApp instances, test records, and temporary users.
Create a single Main Admin superuser with live and clean projects.
"""
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BASE_DIR))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
os.environ["TESTING"] = "1"
os.environ["DEBUG"] = "1"

import django
django.setup()

from django.db import transaction
from core.models import (
    User,
    Organization,
    OrganizationMembership,
    Subscription,
    Project,
    WhatsAppConnection,
    ProviderCredential,
    Contact,
    ContactConsent,
    APIKey,
    Message,
    MessageEvent,
    OTPChallenge,
    Workflow,
    WorkflowVersion,
    WorkflowExecution,
    WebhookEndpoint,
    WebhookDelivery,
    AuditLog,
)

def setup_clean_admin():
    print("=" * 60)
    print("RESETTING DATABASE & CONFIGURING MAIN ADMIN")
    print("=" * 60)

    with transaction.atomic():
        # 1. Clean messages, events, OTP, contacts, consents, keys, workflows, webhooks first
        MessageEvent.objects.all().delete()
        Message.objects.all().delete()
        OTPChallenge.objects.all().delete()
        ContactConsent.objects.all().delete()
        Contact.objects.all().delete()
        APIKey.objects.all().delete()
        WorkflowExecution.objects.all().delete()
        WorkflowVersion.objects.all().delete()
        Workflow.objects.all().delete()
        WebhookDelivery.objects.all().delete()
        WebhookEndpoint.objects.all().delete()
        AuditLog.objects.all().delete()
        print("[1] Cleaned all messages, OTP challenges, contacts, and API keys.")

        # 2. Remove all WhatsApp connections and credentials
        conn_count = WhatsAppConnection.objects.count()
        ProviderCredential.objects.all().delete()
        WhatsAppConnection.objects.all().delete()
        print(f"[2] Removed {conn_count} WhatsApp connection(s) & credentials.")

        # 3. Remove all old projects & memberships & organizations
        Project.objects.all().delete()
        OrganizationMembership.objects.all().delete()
        Subscription.objects.all().delete()
        Organization.objects.all().delete()
        print("[3] Cleaned all old projects and organizations.")

        # 4. Remove all test users
        deleted_users, _ = User.objects.all().delete()
        print(f"[4] Cleaned all old users.")

        # 5. Create the ONE single Main Admin user
        admin_email = "admin@whatsbridge.com"
        admin_pass = "Admin@12345678"
        admin_user = User.objects.create_superuser(
            username=admin_email,
            email=admin_email,
            password=admin_pass,
            email_verified=True,
            is_staff=True,
            is_superuser=True
        )
        print(f"[5] Created Main Admin superuser: {admin_email}")

        # 6. Create Main Organization for Admin
        org = Organization.objects.create(name="WhatsBridge Production", monthly_limit=50000)
        OrganizationMembership.objects.create(organization=org, user=admin_user, role="owner")
        Subscription.objects.create(organization=org)
        print(f"[6] Created Organization: '{org.name}' (Owner: {admin_email})")

        # 7. Create Clean Live Project (Official Meta) and Clean Sandbox Project
        live_project = Project.objects.create(
            organization=org,
            name="Production (Live Meta)",
            sandbox=False
        )
        sandbox_project = Project.objects.create(
            organization=org,
            name="Development Sandbox",
            sandbox=True
        )
        print(f"[7] Created Projects:")
        print(f"    - '{live_project.name}' (ID: {live_project.id}, Sandbox: False - Official Meta)")
        print(f"    - '{sandbox_project.name}' (ID: {sandbox_project.id}, Sandbox: True - Clean Sandbox)")

    print("\n" + "=" * 60)
    print("MAIN ADMIN SETUP COMPLETE!")
    print("=" * 60)
    print(f"Email:    {admin_email}")
    print(f"Password: {admin_pass}")
    print("Role:     Superuser / Platform Admin (is_staff=True, is_superuser=True)")
    print("Status:   Verified (email_verified=True)")
    print(f"Active Connections: 0 (All sandbox connections removed)")
    print("=" * 60)

if __name__ == "__main__":
    setup_clean_admin()
