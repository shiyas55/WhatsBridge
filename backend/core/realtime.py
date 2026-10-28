from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from .models import OrganizationMembership, Project

class ProjectEvents(AsyncJsonWebsocketConsumer):
    @database_sync_to_async
    def authorized(self):
        user=self.scope['user']
        return user.is_authenticated and OrganizationMembership.objects.filter(user=user,organization__project__id=self.scope['url_route']['kwargs']['project_id'],organization__suspended=False).exists()
    async def connect(self):
        if not await self.authorized(): await self.close(code=4403);return
        self.group='project.'+str(self.scope['url_route']['kwargs']['project_id'])
        await self.channel_layer.group_add(self.group,self.channel_name);await self.accept()
    async def disconnect(self,code):
        if hasattr(self,'group'): await self.channel_layer.group_discard(self.group,self.channel_name)
    async def event(self,event):
        if not await self.authorized(): await self.close(code=4403);return
        await self.send_json(event['payload'])
