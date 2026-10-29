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

class SmartSmtpEmailBackend(DjangoSmtpEmailBackend):
    """
    Tries direct SMTP first. If blocked by cloud network (e.g. Render Free tier blocking port 587 with Errno 101),
    automatically routes via the Vercel HTTPS SMTP Relay (port 443) or Resend.
    """
    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        # If Resend API Key is configured, use Resend directly
        resend_key = getattr(settings, 'RESEND_API_KEY', '').strip()
        if resend_key:
            return ResendEmailBackend(fail_silently=self.fail_silently).send_messages(email_messages)

        # First, attempt direct SMTP connection
        try:
            return super().send_messages(email_messages)
        except Exception as smtp_exc:
            err_str = str(smtp_exc)
            logger.warning("Direct SMTP dispatch failed (%s). Attempting HTTPS relay bridge...", err_str)

            # Fallback: Route via Vercel HTTPS SMTP Relay
            public_url = getattr(settings, 'PUBLIC_URL', 'https://whats-bridge.vercel.app').rstrip('/')
            relay_url = f"{public_url}/relay/smtp"
            relay_token = getattr(settings, 'RELAY_SECRET', None) or 'whatsbridge-shared-relay-token-2026'

            host_user = getattr(settings, 'EMAIL_HOST_USER', '').strip()
            host_pass = getattr(settings, 'EMAIL_HOST_PASSWORD', '').replace(' ', '').strip()
            host = getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
            port = getattr(settings, 'EMAIL_PORT', 587)
            use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)

            if not host_user or not host_pass:
                if not self.fail_silently:
                    raise smtp_exc
                return 0

            sent_count = 0
            for msg in email_messages:
                body_html = None
                if getattr(msg, 'alternatives', None):
                    for content, mimetype in msg.alternatives:
                        if mimetype == 'text/html':
                            body_html = content
                            break

                payload = {
                    'token': relay_token,
                    'host': host,
                    'port': port,
                    'secure': use_ssl,
                    'user': host_user,
                    'pass': host_pass,
                    'from': msg.from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', host_user),
                    'to': list(msg.to),
                    'subject': msg.subject,
                    'text': msg.body,
                    'html': body_html
                }

                try:
                    res = requests.post(relay_url, json=payload, timeout=15)
                    if res.status_code == 200:
                        sent_count += 1
                        logger.info("Successfully dispatched email via HTTPS Relay to %s", msg.to)
                    else:
                        resp_data = res.json() if res.headers.get('content-type', '').startswith('application/json') else {}
                        relay_err = resp_data.get('error', res.text)
                        logger.error("HTTPS Relay failed (%d): %s", res.status_code, relay_err)
                        if not self.fail_silently:
                            raise RuntimeError(f"SMTP error ({err_str}), and HTTPS Relay error: {relay_err}")
                except Exception as relay_exc:
                    logger.error("HTTPS Relay exception: %s", relay_exc)
                    if not self.fail_silently:
                        raise RuntimeError(f"SMTP failed ({err_str}), and Relay failed ({relay_exc})")

            return sent_count
