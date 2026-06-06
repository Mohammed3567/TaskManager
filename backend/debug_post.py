import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'taskmanager.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.utils import timezone

User = get_user_model()
user = User.objects.create_user(username='apiuser', password='pass')
client = APIClient()
client.login(username='apiuser', password='pass')

payload = {
    'title': 'API Task',
    'date': timezone.now().isoformat(),
    'priority': 'IMPORTANT',
    'tag_names': ['Study', 'Urgent']
}
resp = client.post('/api/tasks/', payload, format='json')
print('status:', resp.status_code)
print('data:', resp.data)
print('content:', getattr(resp, 'content', None))
