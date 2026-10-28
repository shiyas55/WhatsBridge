"""Normalize operator-supplied deployment settings without dropping TLS options."""
from urllib.parse import urlparse, parse_qs, unquote

def service_url(value):
    value = value.strip().rstrip('/')
    if not value:
        return ''
    if '://' not in value:
        value = 'http://' + value  # Render private host:port, not public HTTPS
    parsed = urlparse(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username:
        raise ValueError('Provider URL must be an HTTP(S) service URL without credentials')
    return value

def database_config(value):
    parsed = urlparse(value)
    if parsed.scheme not in ('postgres', 'postgresql'):
        raise ValueError('DATABASE_URL must be a PostgreSQL URL')
    query = parse_qs(parsed.query)
    options = {name: query[name][-1] for name in ('sslmode', 'sslrootcert', 'channel_binding', 'connect_timeout') if name in query}
    return {'ENGINE':'django.db.backends.postgresql','NAME':unquote(parsed.path[1:]),'USER':unquote(parsed.username or ''),'PASSWORD':unquote(parsed.password or ''),'HOST':parsed.hostname,'PORT':parsed.port or 5432,'CONN_MAX_AGE':60,'OPTIONS':options}
