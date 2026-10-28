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
