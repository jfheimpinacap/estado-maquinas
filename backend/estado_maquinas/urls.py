from django.urls import path, include
from api.admin_site import admin_site

urlpatterns = [
    path('admin/', admin_site.urls),
    path('', include('api.urls')),
]



