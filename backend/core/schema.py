from drf_spectacular.extensions import OpenApiAuthenticationExtension


class ProjectKeyScheme(OpenApiAuthenticationExtension):
    target_class = "core.security.ProjectKeyAuthentication"
    name = "ProjectAPIKey"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "description": "Project-scoped wb_test_ or wb_live_ API key. Keep it on your server.",
        }
