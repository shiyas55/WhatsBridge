"""Small server-side client; set base_url and key from your secret store."""
import requests
class WhatsBridge:
    def __init__(self,base_url,key):
        self.base=base_url.rstrip('/')
        self.session=requests.Session()
        self.session.headers['Authorization']='Bearer '+key
    def request(self,path,data=None,idempotency_key=None):
        headers={'Idempotency-Key':idempotency_key} if idempotency_key else {}
        response=self.session.request('POST' if data is not None else 'GET',self.base+'/api/v1/'+path,json=data,headers=headers,timeout=30)
        response.raise_for_status()
        return response.json()
    def send(self,connection,phone,body,idempotency_key):
        return self.request('messages',{'connection':connection,'phone':phone,'kind':'text','payload':{'body':body}},idempotency_key)
