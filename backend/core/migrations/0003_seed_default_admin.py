from django.db import migrations
import os

def create_default_admin(apps, schema_editor):
    """
    Seed initial superuser from environment variables if provided.
    Credentials and email addresses are never hardcoded in the codebase.
    """
    admin_email = os.environ.get('DEFAULT_ADMIN_EMAIL')
    admin_password = os.environ.get('DEFAULT_ADMIN_PASSWORD')
    if not admin_email or not admin_password:
        return

    User = apps.get_model('core', 'User')
    Organization = apps.get_model('core', 'Organization')
    OrganizationMembership = apps.get_model('core', 'OrganizationMembership')
    Subscription = apps.get_model('core', 'Subscription')
    Project = apps.get_model('core', 'Project')
    from django.contrib.auth.hashers import make_password

    admin_user, _ = User.objects.get_or_create(
        email=admin_email,
        defaults={
            'username': admin_email,
            'first_name': 'Admin',
            'is_staff': True,
            'is_superuser': True,
            'email_verified': True,
        }
    )
    admin_user.password = make_password(admin_password)
    admin_user.email_verified = True
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.save()

    if not OrganizationMembership.objects.filter(user=admin_user).exists():
        org = Organization.objects.first()
        if not org:
            org = Organization.objects.create(name='WhatsBridge Production', monthly_limit=50000)
            Subscription.objects.get_or_create(organization=org)
        OrganizationMembership.objects.create(organization=org, user=admin_user, role='owner')
        if not Project.objects.filter(organization=org).exists():
            Project.objects.create(organization=org, name='Live WhatsApp Project', sandbox=False)

def reverse_admin(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('core', '0002_alter_whatsappconnection_provider'),
    ]

    operations = [
        migrations.RunPython(create_default_admin, reverse_admin),
    ]
