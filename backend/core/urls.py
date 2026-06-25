from django.urls import path, include
from rest_framework import routers
from .views import TagViewSet, RecurrenceExceptionViewSet
from .views import AnalyticsView

router = routers.DefaultRouter()
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'exceptions', RecurrenceExceptionViewSet, basename='exception')

urlpatterns = [
    path('', include(router.urls)),
    path('analytics/', AnalyticsView.as_view(), name='analytics'),
]
