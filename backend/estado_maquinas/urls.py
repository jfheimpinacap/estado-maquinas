from django.urls import path, include
from api.admin_site import admin_site
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin_site.urls),
    path('', include('api.urls')),
    path('auth/refresh', TokenRefreshView.as_view(), name='token_refresh'),
]




