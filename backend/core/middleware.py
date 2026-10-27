import re

class NormalizePathMiddleware:
    """
    Normalizes consecutive slashes (e.g., //api/auth/session -> /api/auth/session)
    caused by reverse proxies or environment variables with trailing slashes.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if "//" in request.path_info:
            request.path_info = re.sub(r"/+", "/", request.path_info)
        return self.get_response(request)
