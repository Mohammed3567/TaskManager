import http.cookiejar
import urllib.request
import urllib.parse
import uuid
import datetime
import json

base = 'http://127.0.0.1:8000'
print('base', base)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def do_request(method, path, data=None, headers=None):
    url = base + path
    body = None
    req_headers = headers.copy() if headers else {}
    if data is not None:
        body = json.dumps(data).encode('utf-8')
        req_headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    with opener.open(req) as resp:
        text = resp.read().decode('utf-8')
        return resp.getcode(), text

code, text = do_request('GET', '/api/auth/csrf/')
print('csrf get', code)
csrf = json.loads(text)['csrfToken']
print('csrf', csrf[:8])
headers = {'X-CSRFToken': csrf, 'Referer': 'http://127.0.0.1:8000/'}
username = 'e2euser_' + uuid.uuid4().hex[:6]
password = 'TestPass123!'
print('registering', username)
payload = {'username': username, 'password': password, 'email': username + '@example.com'}
code, text = do_request('POST', '/api/auth/register/', data=payload, headers=headers)
print('register', code, text[:200])
if code != 201:
    print('register failed')
    raise SystemExit('register failed')
print('register success')

code, text = do_request('POST', '/api/auth/login/', data={'username': username, 'password': password}, headers=headers)
print('login', code, text[:200])
if code != 200:
    raise SystemExit('login failed')

code, text = do_request('GET', '/api/auth/csrf/')
csrf = json.loads(text)['csrfToken']
headers['X-CSRFToken'] = csrf
print('creating recurring task')
start = datetime.datetime.now(datetime.timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0)
payload = {
    'title': 'E2E Recurring Task',
    'date': start.isoformat(),
    'priority': 'IMPORTANT',
    'is_recurring': True,
    'recurrence_rule': 'FREQ=DAILY;COUNT=5',
    'tag_names': ['E2E', 'Test']
}
code, text = do_request('POST', '/api/tasks/', data=payload, headers=headers)
print('create task', code, text[:200])
if code != 201:
    raise SystemExit('task create failed')
task = json.loads(text)
task_id = task['id']
print('task id', task_id)
start_str = urllib.parse.quote(start.isoformat())
end_str = urllib.parse.quote((start + datetime.timedelta(days=6)).isoformat())
code, text = do_request('GET', f'/api/tasks/occurrences/?start={start_str}&end={end_str}')
print('occurrences fetch', code)
if code != 200:
    raise SystemExit('occurrences fetch failed')
occs = json.loads(text)
print('occ count', len(occs), 'sample', occs[:2])
occurrence = occs[1]['date']
print('editing occurrence', occurrence)
override = {'override_data': {'title': 'Edited occurrence title', 'priority': 'CRITICAL'}}
code, text = do_request('PUT', f'/api/tasks/{task_id}/?mode=instance&occurrence={urllib.parse.quote(occurrence)}', data=override, headers=headers)
print('instance update', code, text[:200])
if code != 200:
    raise SystemExit('instance update failed')
code, text = do_request('GET', f'/api/tasks/occurrences/?start={start_str}&end={end_str}')
print('after edit fetch', code)
occs2 = json.loads(text)
print('titles', [o['title'] for o in occs2])
print('deleting occurrence', occurrence)
code, text = do_request('DELETE', f'/api/tasks/{task_id}/?mode=instance&occurrence={urllib.parse.quote(occurrence)}', headers=headers)
print('delete', code, text[:200])
if code not in (200, 204):
    raise SystemExit('delete failed')
code, text = do_request('GET', f'/api/tasks/occurrences/?start={start_str}&end={end_str}')
print('after delete count', code, len(json.loads(text)))
print('dates', [o['date'] for o in json.loads(text)])
