import requests
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class ResendEmailBackend(BaseEmailBackend):
    """
    Sends outbound emails via Resend's HTTPS REST API (Port 443).
    Bypasses cloud provider SMTP port 587/465 firewall restrictions (e.g., Render Free tier).
    """
    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        key = getattr(settings, 'RESEND_API_KEY', '').strip()
        if not key:
            return 0
        sent = 0
        for msg in email_messages:
            try:
                from_email = msg.from_email or settings.DEFAULT_FROM_EMAIL
                # If custom domain is not yet verified on Resend, Resend's sandbox sender is onboarding@resend.dev
                if 'onboarding@resend.dev' not in from_email and not getattr(settings, 'RESEND_CUSTOM_DOMAIN', False):
                    from_email = 'WhatsBridge <onboarding@resend.dev>'

                body_html = None
                if getattr(msg, 'alternatives', None):
                    for content, mimetype in msg.alternatives:
                        if mimetype == 'text/html':
                            body_html = content
                            break

                payload = {
                    'from': from_email,
                    'to': list(msg.to),
                    'subject': msg.subject,
                    'text': msg.body,
                }
                if body_html:
                    payload['html'] = body_html

                res = requests.post(
                    'https://api.resend.com/emails',
                    headers={
                        'Authorization': f'Bearer {key}',
                        'Content-Type': 'application/json'
                    },
                    json=payload,
                    timeout=10
                )
                if res.status_code in (200, 201):
                    sent += 1
                else:
                    logger.warning("Resend API error (%d): %s", res.status_code, res.text)
                    if not self.fail_silently:
                        raise RuntimeError(f"Resend error: {res.text}")
            except Exception as exc:
                logger.warning("Resend dispatch failed: %s", exc)
                if not self.fail_silently:
                    raise
        return sent
