import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','taskmanager.settings')
django.setup()
from django.test.client import Client
c = Client()
if c.login(username='hasan', password='jannaty53'):
    print('OK', c.session.session_key)
else:
    print('FAIL')
