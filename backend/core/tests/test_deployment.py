import pytest
from config.environment import service_url, database_config

def test_render_private_service_address_preserves_port():
    assert service_url('qr-internal:10000') == 'http://qr-internal:10000'
    assert service_url('https://gateway.example.com/') == 'https://gateway.example.com'

@pytest.mark.parametrize('value',['ftp://internal:4000','http://token@internal:4000'])
def test_service_url_rejects_wrong_protocol_or_embedded_secret(value):
    with pytest.raises(ValueError):service_url(value)

def test_hosted_database_keeps_tls_options_and_encoded_password():
    db=database_config('postgresql://user:p%40ss@db.example.com/app?sslmode=require&channel_binding=require')
    assert db['PASSWORD']=='p@ss'
    assert db['OPTIONS']=={'sslmode':'require','channel_binding':'require'}

def test_connector_preserves_tenant_route_and_reports_deployed_mismatch(settings):
    from types import SimpleNamespace
    from unittest.mock import patch, Mock
    from rest_framework.exceptions import ValidationError
    from core.experimental import connector
    settings.BAILEYS_ENABLED=True; settings.BAILEYS_TOKEN='private-test-token'
    settings.BAILEYS_URL='https://qr.example.test'
    connection=SimpleNamespace(id='connection',project_id='project',project=SimpleNamespace(organization_id='organization'))
    response=Mock(status_code=404,ok=False)
    with patch('core.experimental.requests.request',return_value=response) as request:
        with pytest.raises(ValidationError,match='does not support this pairing route'):
            connector(connection,'POST','/pair',{})
        assert request.call_args.args[:2]==('POST','https://qr.example.test/sessions/organization/project/connection/pair')
        assert request.call_args.kwargs['headers']['Authorization']=='Bearer private-test-token'
