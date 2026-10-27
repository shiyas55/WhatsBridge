# Integration sketches

These examples assume your application has authenticated the customer, checked
recipient authorization, and recorded consent in WhatsBridge. Keep keys in a
secret store. Stable business-event IDs are essential for idempotency.

## Django

```python
from django.conf import settings
from .python_sdk import WhatsBridge

# Called after your application authorizes the order and commits its transaction.
def notify_order(order):
    client = WhatsBridge(settings.WHATSBRIDGE_URL, settings.WHATSBRIDGE_KEY)
    return client.send(settings.WHATSBRIDGE_CONNECTION, order.phone,
                       'Your order is confirmed.', f'order:{order.pk}:confirmed')
```

## Next.js App Router — server-side route

```typescript
import 'server-only';
import { WhatsBridge } from './typescript_sdk';

// Invoke only after checking your application's session and order ownership.
export async function notifyAuthorizedOrder(order:{id:string;phone:string}) {
  const client = new WhatsBridge(process.env.WHATSBRIDGE_URL!, process.env.WHATSBRIDGE_KEY!);
  return client.send(process.env.WHATSBRIDGE_CONNECTION!, order.phone,
    'Your order is confirmed.', `order:${order.id}:confirmed`);
}
```

## Laravel

```php
use Illuminate\Support\Facades\Http;

// Resolve $order from authenticated server-side state and authorize it first.
$response = Http::withToken(config('services.whatsbridge.key'))
    ->withHeaders(['Idempotency-Key' => 'order:'.$order->id.':confirmed'])
    ->timeout(30)->post(config('services.whatsbridge.url').'/api/v1/messages', [
        'connection' => config('services.whatsbridge.connection'),
        'phone' => $order->phone,
        'kind' => 'text',
        'payload' => ['body' => 'Your order is confirmed.'],
    ])->throw()->json();
```

For real outbound notifications outside the service window, replace text payloads
with the approved template payload documented in API.md. A queued response does
not prove customer delivery. Do not retry a business event under a new ID merely
because a network response was lost.
