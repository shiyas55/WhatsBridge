from django.db import migrations

def ensure_production_org(apps, schema_editor):
    Organization = apps.get_model('core', 'Organization')
    OrganizationMembership = apps.get_model('core', 'OrganizationMembership')
    Subscription = apps.get_model('core', 'Subscription')
    User = apps.get_model('core', 'User')
    Project = apps.get_model('core', 'Project')

    # 1. Rename any 'Dev Workspace' or get_or_create 'WhatsBridge Production'
    dev_org = Organization.objects.filter(name='Dev Workspace').first()
    prod_org = Organization.objects.filter(name='WhatsBridge Production').first()

    if not prod_org:
        if dev_org:
            dev_org.name = 'WhatsBridge Production'
            dev_org.monthly_limit = 50000
            dev_org.save()
            prod_org = dev_org
        else:
            prod_org = Organization.objects.create(name='WhatsBridge Production', monthly_limit=50000)

    Subscription.objects.get_or_create(organization=prod_org)

    # 2. Add all existing users to WhatsBridge Production
    for user in User.objects.all():
        OrganizationMembership.objects.get_or_create(
            organization=prod_org,
            user=user,
            defaults={'role': 'owner'}
        )

    # 3. Ensure all projects are live / production (sandbox=False)
    Project.objects.all().update(sandbox=False)

def reverse_production_org(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('core', '0003_seed_default_admin'),
    ]

    operations = [
        migrations.RunPython(ensure_production_org, reverse_production_org),
    ]
