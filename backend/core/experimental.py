"""Private boundary for opt-in experimental account linking."""
import requests
from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .services import emit

def endpoint(connection):
    if not settings.BAILEYS_ENABLED or not settings.BAILEYS_TOKEN:
        raise ValidationError('Experimental QR connector is disabled')
    return settings.BAILEYS_URL+'/sessions/'+str(connection.project.organization_id)+'/'+str(connection.project_id)+'/'+str(connection.id)

def connector(connection,method='GET',action='',data=None):
    try:
        response=requests.request(method,endpoint(connection)+action,json=data,headers={'Authorization':'Bearer '+settings.BAILEYS_TOKEN},timeout=15)
        if not response.ok: raise ValidationError('Experimental connector could not complete the request')
        return response.json()
    except (requests.RequestException,ValueError):raise ValidationError('Experimental connector is unavailable')

def sync_state(connection,data):
    state=data.get('status')
    if state not in ['CREATED','PAIRING','CONNECTED','DISCONNECTED','RECONNECTING','FAILED','REVOKED']:raise ValidationError('Invalid connector state')
    previous=connection.status;connection.status=state;connection.error=str(data.get('error',''))[:250]
    if state=='CONNECTED' and previous!='CONNECTED':connection.last_connected_at=timezone.now()
    connection.save(update_fields=['status','error','last_connected_at'])
    if previous!=state and state in ['CONNECTED','DISCONNECTED']:
        emit(connection.project,'connection.'+state.lower(),{'connection_id':str(connection.id),'experimental':True})
