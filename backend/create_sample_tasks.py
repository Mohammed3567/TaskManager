import os
import django
from datetime import datetime, timedelta
os.environ.setdefault('DJANGO_SETTINGS_MODULE','taskmanager.settings')
django.setup()
from django.contrib.auth import get_user_model
from core.models import Task, RecurrenceException
User = get_user_model()

u = User.objects.filter(username='hasan').first()
if not u:
    print('user hasan not found')
    exit(1)

# create a recurring daily task
start = datetime.utcnow().replace(hour=9, minute=0, second=0, microsecond=0)
if not Task.objects.filter(title='Daily standup', user=u).exists():
    t = Task.objects.create(user=u, title='Daily standup', description='Team sync', date=start, duration_minutes=30, is_recurring=True, recurrence_rule='FREQ=DAILY;COUNT=14', timezone='UTC')
    print('created task', t.id)
else:
    t = Task.objects.filter(title='Daily standup', user=u).first()
    print('task exists', t.id)

# add an exception: delete third occurrence
occ_date = (start + timedelta(days=2)).isoformat()
if not RecurrenceException.objects.filter(task=t, occurrence_date=occ_date).exists():
    RecurrenceException.objects.create(task=t, occurrence_date=occ_date, is_deleted=True)
    print('created delete exception for', occ_date)

# add an override: change title on 5th occurrence
occ2 = (start + timedelta(days=4)).isoformat()
if not RecurrenceException.objects.filter(task=t, occurrence_date=occ2).exists():
    RecurrenceException.objects.create(task=t, occurrence_date=occ2, is_deleted=False, override_data={'title':'Special standup'})
    print('created override exception for', occ2)

print('done')
