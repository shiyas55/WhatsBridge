"""HTTPS-only, allowlisted outbound calls with DNS addresses pinned per connection."""
import http.client, ipaddress, socket, ssl
from urllib.parse import urlparse
from django.conf import settings
from rest_framework.exceptions import ValidationError

def post(url, body, headers=None, timeout=10):
    parsed=urlparse(url)
    if parsed.scheme!='https' or parsed.username or parsed.password or parsed.port not in (None,443) or parsed.hostname not in settings.WEBHOOK_ALLOWED_HOSTS:
        raise ValidationError('Destination not approved')
    addresses=socket.getaddrinfo(parsed.hostname,443,type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValidationError('Private or reserved destination')
    address=addresses[0][4][0]
    class PinnedHTTPS(http.client.HTTPSConnection):
        def connect(self):
            # Use the numeric validated address, but verify TLS for original DNS name.
            sock=socket.create_connection((address,443),timeout)
            self.sock=self._context.wrap_socket(sock,server_hostname=parsed.hostname)
    connection=PinnedHTTPS(parsed.hostname,443,timeout=timeout,context=ssl.create_default_context())
    try:
        path=parsed.path or '/'
        if parsed.query:path+='?'+parsed.query
        connection.request('POST',path,body=body,headers={'Host':parsed.hostname,'Content-Type':'application/json',**(headers or {})})
        response=connection.getresponse()
        # Only the status is consumed. No redirects, proxies or unbounded body reads.
        return response.status
    finally:connection.close()
