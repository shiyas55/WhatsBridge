import urllib.parse
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from .models import OrganizationMembership, Project

class ProjectEvents(AsyncJsonWebsocketConsumer):
    @database_sync_to_async
    def authorized(self):
        project_id = self.scope['url_route']['kwargs'].get('project_id')
        if not project_id:
            return False
        user = self.scope.get('user')
        if user and getattr(user, 'is_authenticated', False) and OrganizationMembership.objects.filter(user=user, organization__project__id=project_id, organization__suspended=False).exists():
            return True
        # Cross-origin fallback via query string parameter (e.g. ?uid=... or ?session_id=...)
        try:
            query_string = self.scope.get('query_string', b'').decode('utf-8')
            params = dict(urllib.parse.parse_qsl(query_string))
            uid = params.get('uid')
            if uid and OrganizationMembership.objects.filter(user_id=uid, organization__project__id=project_id, organization__suspended=False).exists():
                return True
            session_key = params.get('session_id')
            if session_key:
                from django.contrib.sessions.models import Session
                s = Session.objects.filter(session_key=session_key).first()
                if s:
                    s_uid = s.get_decoded().get('_auth_user_id')
                    if s_uid and OrganizationMembership.objects.filter(user_id=s_uid, organization__project__id=project_id, organization__suspended=False).exists():
                        return True
        except Exception:
            pass
        return False

    async def connect(self):
        if not await self.authorized(): await self.close(code=4403);return
        self.group='project.'+str(self.scope['url_route']['kwargs']['project_id'])
        await self.channel_layer.group_add(self.group,self.channel_name);await self.accept()
    async def disconnect(self,code):
        if hasattr(self,'group'): await self.channel_layer.group_discard(self.group,self.channel_name)
    async def event(self,event):
        if not await self.authorized(): await self.close(code=4403);return
        await self.send_json(event['payload'])
