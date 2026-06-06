import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','taskmanager.settings')
django.setup()
from django.db import connection
username = 'hasan'
with connection.cursor() as cur:
    cur.execute("DELETE FROM auth_user WHERE username=%s", [username])
    print('deleted rows:', cur.rowcount)
    connection.commit()
