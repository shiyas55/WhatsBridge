import hashlib, hmac, time

def verify(secret, timestamp, raw_body, signature):
    try:
        if abs(time.time()-int(timestamp))>300:return False
    except (ValueError,TypeError):return False
    expected=hmac.new(secret.encode(),str(timestamp).encode()+b'.'+raw_body,hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected,signature)

# After signature verification, atomically INSERT X-WhatsBridge-ID into a table
# with a UNIQUE constraint. A duplicate is a replay: acknowledge it without
# repeating side effects. Store the body/queue job in the same transaction.
