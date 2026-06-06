import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'taskmanager.settings')
django.setup()
from django.core.management import call_command
call_command('migrate', '--noinput')

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import datetime, timedelta
from core.models import Task

User = get_user_model()
user, _ = User.objects.get_or_create(username='debuguser')
user.set_password('pass')
user.save()
client = APIClient()
client.login(username='debuguser', password='pass')

start = timezone.make_aware(datetime(2026,6,1))
task = Task.objects.create(user=user, title='Weekly API Task', date=start, priority='ROUTINE', is_recurring=True, recurrence_rule='FREQ=WEEKLY;COUNT=3')

# create exception via API
second_occ = (start + timedelta(weeks=1)).isoformat()
payload = {'task': str(task.id), 'occurrence_date': second_occ, 'is_deleted': True}
resp = client.post('/api/core/exceptions/', payload, format='json')
print('exception create status', resp.status_code, resp.data)

occ_url = '/api/tasks/occurrences/'
resp2 = client.get(occ_url + f'?start={start.isoformat()}&end={(start+timedelta(days=21)).isoformat()}')
print('occurrences status', resp2.status_code)
print(resp2.data)
