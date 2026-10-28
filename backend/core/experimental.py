"""Private boundary for opt-in experimental account linking."""
import requests
from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .services import emit

def endpoint(connection):
    if not settings.BAILEYS_ENABLED:
        raise ValidationError('WhatsApp QR connector is disabled')
    url = settings.BAILEYS_URL or 'https://whatsbridge-gateway.onrender.com'
    if not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url
    return url.rstrip('/') + '/sessions/' + str(connection.project.organization_id) + '/' + str(connection.project_id) + '/' + str(connection.id)

def connector(connection,method='GET',action='',data=None):
    try:
        headers = {}
        token = settings.BAILEYS_TOKEN or settings.GATEWAY_TOKEN
        if token:
            headers['Authorization'] = 'Bearer ' + token
        response=requests.request(method,endpoint(connection)+action,json=data,headers=headers,timeout=15)
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
        raise ValidationError(f'WhatsApp Gateway unreachable: {str(e)}')
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
