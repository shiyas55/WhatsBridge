from django.http import JsonResponse, HttpResponse
from django.db import connection
from django.core.cache import cache
from django.contrib.auth.decorators import user_passes_test
from .models import Message, WebhookDelivery

def health(request):
    db_ok = False
    cache_ok = False
    try:
        with connection.cursor() as cursor: cursor.execute('SELECT 1')
        db_ok = True
    except Exception:
        pass
    try:
        cache.set('health', True, 10)
        cache_ok = True
    except Exception:
        pass
    if db_ok:
        return JsonResponse({'status': 'ok', 'database': 'ok', 'cache': 'ok' if cache_ok else 'in_memory'})
    return JsonResponse({'status': 'unavailable', 'database': 'failed'}, status=503)

@user_passes_test(lambda user:user.is_superuser)
def metrics(request):
    return HttpResponse(f'whatsbridge_messages_queued {Message.objects.filter(status="queued").count()}\nwhatsbridge_webhooks_dead {WebhookDelivery.objects.filter(status="dead").count()}\n',content_type='text/plain')
