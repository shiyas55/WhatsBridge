from django.db import migrations

def create_default_admin(apps, schema_editor):
    User = apps.get_model('core', 'User')
    Organization = apps.get_model('core', 'Organization')
    OrganizationMembership = apps.get_model('core', 'OrganizationMembership')
    Subscription = apps.get_model('core', 'Subscription')
    Project = apps.get_model('core', 'Project')
    from django.contrib.auth.hashers import make_password

    # 1. Admin user: admin@whatsbridge.com
    admin_user, _ = User.objects.get_or_create(
        email='admin@whatsbridge.com',
        defaults={
            'username': 'admin@whatsbridge.com',
            'first_name': 'Admin',
            'is_staff': True,
            'is_superuser': True,
            'email_verified': True,
        }
    )
    admin_user.password = make_password('Password123!@#')
    admin_user.email_verified = True
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.save()

    # 2. User account: shiyasahmad555@gmail.com
    shiyas_user, _ = User.objects.get_or_create(
        email='shiyasahmad555@gmail.com',
        defaults={
            'username': 'shiyasahmad555@gmail.com',
            'first_name': 'Shiyas',
            'is_staff': True,
            'is_superuser': True,
            'email_verified': True,
        }
    )
    shiyas_user.password = make_password('Password123!@#')
    shiyas_user.email_verified = True
    shiyas_user.is_staff = True
    shiyas_user.is_superuser = True
    shiyas_user.save()

    # Ensure an organization exists
    for u in [admin_user, shiyas_user]:
        if not OrganizationMembership.objects.filter(user=u).exists():
            org = Organization.objects.first()
            if not org:
                org = Organization.objects.create(name='WhatsBridge Production', monthly_limit=50000)
                Subscription.objects.get_or_create(organization=org)
            OrganizationMembership.objects.create(organization=org, user=u, role='owner')
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
