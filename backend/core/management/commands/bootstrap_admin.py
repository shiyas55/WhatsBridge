import getpass
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.password_validation import validate_password
from django.core.validators import validate_email
from core.models import User


class Command(BaseCommand):
    help = "Create a verified platform administrator interactively; no default password"

    def handle(self, *args, **options):
        email = input("Administrator email: ").strip().lower()
        try:
            validate_email(email)
        except Exception:
            raise CommandError("Invalid email")
        if User.objects.filter(email=email).exists():
            raise CommandError("Account already exists; refusing to change it")
        password = getpass.getpass("Password (12+ characters): ")
        if password != getpass.getpass("Confirm password: "):
            raise CommandError("Passwords do not match")
        try:
            validate_password(password)
        except Exception as exc:
            raise CommandError(str(exc))
        User.objects.create_superuser(
            username=email, email=email, password=password, email_verified=True
        )
        self.stdout.write(
            "Administrator created. Sign in through the dashboard and enable TOTP before live use."
        )
