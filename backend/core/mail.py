import os
import requests
import json
import logging
from django.core.mail.backends.smtp import EmailBackend as DjangoSmtpEmailBackend
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings

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
                if 'onboarding@resend.dev' not in from_email and not getattr(settings, 'RESEND_CUSTOM_DOMAIN', False):
                    from_email = 'WhatsBridge <onboarding@resend.dev>'

                body_html = None
                if getattr(msg, 'content_subtype', None) == 'html':
                    body_html = msg.body
                elif getattr(msg, 'alternatives', None):
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

class BrevoEmailBackend(BaseEmailBackend):
    """
    Sends outbound emails via Brevo's (Sendinblue) HTTPS REST API (Port 443).
    Bypasses cloud provider SMTP port 587/465 firewall restrictions (e.g., Render Free tier).
    Free tier supports 300 emails/day.
    """
    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        key = getattr(settings, 'BREVO_API_KEY', '').strip()
        if not key:
            return 0
        sent = 0
        for msg in email_messages:
            try:
                from_email = msg.from_email or settings.DEFAULT_FROM_EMAIL
                sender_name = 'WhatsBridge'
                sender_email = getattr(settings, 'EMAIL_HOST_USER', 'whatsbridges@gmail.com') or 'whatsbridges@gmail.com'
                if '<' in from_email and '>' in from_email:
                    parts = from_email.split('<')
                    sender_name = parts[0].strip() or 'WhatsBridge'
                    sender_email = parts[1].replace('>', '').strip()
                elif '@' in from_email:
                    sender_email = from_email.strip()

                body_html = None
                if getattr(msg, 'content_subtype', None) == 'html':
                    body_html = msg.body
                elif getattr(msg, 'alternatives', None):
                    for content, mimetype in msg.alternatives:
                        if mimetype == 'text/html':
                            body_html = content
                            break

                to_list = [{'email': rec} for rec in msg.to]
                payload = {
                    'sender': {'name': sender_name, 'email': sender_email},
                    'to': to_list,
                    'subject': msg.subject,
                    'textContent': msg.body,
                }
                if body_html:
                    payload['htmlContent'] = body_html

                res = requests.post(
                    'https://api.brevo.com/v3/smtp/email',
                    headers={
                        'api-key': key,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    json=payload,
                    timeout=10
                )
                if res.status_code in (200, 201):
                    sent += 1
                else:
                    logger.warning("Brevo API error (%d): %s", res.status_code, res.text)
                    if not self.fail_silently:
                        raise RuntimeError(f"Brevo error: {res.text}")
            except Exception as exc:
                logger.warning("Brevo dispatch failed: %s", exc)
                if not self.fail_silently:
                    raise
        return sent

class SmartSmtpEmailBackend(DjangoSmtpEmailBackend):
    """
    Tries direct SMTP first. If blocked by cloud network (e.g. Render Free tier blocking port 587 with Errno 101),
    automatically routes via Resend (HTTPS 443), Brevo (HTTPS 443), or returns actionable instructions.
    """
    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        # If Resend API Key is configured, use Resend directly over HTTPS Port 443
        resend_key = getattr(settings, 'RESEND_API_KEY', '').strip()
        if resend_key:
            return ResendEmailBackend(fail_silently=self.fail_silently).send_messages(email_messages)

        # If Brevo API Key is configured, use Brevo directly over HTTPS Port 443
        brevo_key = getattr(settings, 'BREVO_API_KEY', '').strip()
        if brevo_key:
            return BrevoEmailBackend(fail_silently=self.fail_silently).send_messages(email_messages)

        # Attempt direct SMTP connection
        try:
            return super().send_messages(email_messages)
        except Exception as smtp_exc:
            err_str = str(smtp_exc)
            logger.warning("Direct SMTP dispatch failed (%s).", err_str)
            if '101' in err_str or 'Network is unreachable' in err_str:
                hint = (
                    "Render Free Tier blocks outbound SMTP port 587 ([Errno 101] Network is unreachable). "
                    "To send emails 100% free over HTTPS Port 443, set RESEND_API_KEY (from resend.com) "
                    "or BREVO_API_KEY (from brevo.com) in your Render Environment Variables."
                )
                if not self.fail_silently:
                    raise RuntimeError(hint)
            if not self.fail_silently:
                raise smtp_exc
            return 0
