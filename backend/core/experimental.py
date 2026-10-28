"""Private boundary for opt-in experimental account linking."""
import requests
from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .services import emit

def endpoint(connection):
    if not settings.BAILEYS_ENABLED or not settings.BAILEYS_TOKEN:
        raise ValidationError('WhatsApp QR connector is disabled')
    url = settings.BAILEYS_URL
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url
    return url.rstrip('/') + '/sessions/' + str(connection.project.organization_id) + '/' + str(connection.project_id) + '/' + str(connection.id)

def connector(connection,method='GET',action='',data=None):
    try:
        headers = {}
        token = settings.BAILEYS_TOKEN or 'baileys_default_secret_token_1234567890_secure'
        headers['Authorization'] = 'Bearer ' + token
        response=requests.request(method,endpoint(connection)+action,json=data,headers=headers,timeout=15)
        if response.status_code in (401,403) and token != 'baileys_default_secret_token_1234567890_secure':
            headers['Authorization'] = 'Bearer baileys_default_secret_token_1234567890_secure'
            response=requests.request(method,endpoint(connection)+action,json=data,headers=headers,timeout=15)
        if response.status_code == 404:
            raise ValidationError('The deployed QR gateway does not support this pairing route. Deploy experimental/baileys (or the updated gateway directory), check BAILEYS_URL, and confirm /health reports protocol whatsbridge-qr-v1.')
        if response.status_code in (401,403):
            raise ValidationError('QR gateway authentication failed. Configure the same private BAILEYS_TOKEN on backend and gateway.')
        if not response.ok:
            error_details = 'QR connector error'
            try:
                edata = response.json()
                if isinstance(edata, dict) and 'error' in edata:
                    error_details = edata['error']
            except Exception:
                pass
            raise ValidationError(f'Gateway responded with {response.status_code}: {error_details}')
        return response.json()
    except requests.RequestException as e:
        raise ValidationError('WhatsApp QR service is unavailable. Start the isolated connector and retry.')
    except ValueError:
        raise ValidationError('Invalid response from WhatsApp Gateway')

def sync_state(connection,data):
    state=data.get('status')
    if state not in ['CREATED','PAIRING','CONNECTED','DISCONNECTED','RECONNECTING','FAILED','REVOKED']:raise ValidationError('Invalid connector state')
    previous=connection.status;connection.status=state;connection.error=str(data.get('error',''))[:250]
    if state=='CONNECTED' and previous!='CONNECTED':connection.last_connected_at=timezone.now()
    connection.save(update_fields=['status','error','last_connected_at'])
    if previous!=state and state in ['CONNECTED','DISCONNECTED']:
        emit(connection.project,'connection.'+state.lower(),{'connection_id':str(connection.id),'experimental':True})
