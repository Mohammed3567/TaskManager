import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'taskmanager.settings')
django.setup()
from django.utils.dateparse import parse_datetime
dt = parse_datetime('2026-06-01T00:00:00+00:00')
print(dt, type(dt), dt.tzinfo)
