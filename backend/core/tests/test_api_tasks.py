from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import datetime, timedelta
from ..models import Task, RecurrenceException


class TaskAPITests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='apiuser', password='pass')
        self.client = APIClient()
        self.client.login(username='apiuser', password='pass')

    def test_create_task_with_tags(self):
        url = reverse('task-list')
        payload = {
            'title': 'API Task',
            'date': timezone.now().isoformat(),
            'priority': 'IMPORTANT',
            'tag_names': ['Study', 'Urgent']
        }
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, 201)
        task_id = resp.data['id']
        task = Task.objects.get(id=task_id)
        self.assertEqual(task.tags.count(), 2)

    def test_create_exception_via_api_and_occurrence_reflects(self):
        start = timezone.make_aware(datetime(2026, 6, 1))
        task = Task.objects.create(
            user=self.user,
            title='Weekly API Task',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=WEEKLY;COUNT=3'
        )

        # create exception via API
        url = reverse('exception-list')
        second_occ = (start + timedelta(weeks=1)).isoformat()
        payload = {
            'task': str(task.id),
            'occurrence_date': second_occ,
            'is_deleted': True
        }
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, 201)

        # call occurrences endpoint
        occ_url = reverse('task-occurrences')
        resp2 = self.client.get(occ_url + f'?start={start.isoformat()}&end={(start+timedelta(days=21)).isoformat()}')
        self.assertEqual(resp2.status_code, 200)
        # 3 occurrences minus 1 deleted => 2
        self.assertEqual(len(resp2.data), 2)

    def test_create_exception_override_via_api_reflects(self):
        start = timezone.make_aware(datetime(2026, 6, 1))
        task = Task.objects.create(
            user=self.user,
            title='Weekly API Task',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=WEEKLY;COUNT=3'
        )

        # create override exception via API
        url = reverse('exception-list')
        second_occ = (start + timedelta(weeks=1)).isoformat()
        payload = {
            'task': str(task.id),
            'occurrence_date': second_occ,
            'is_deleted': False,
            'override_data': {'title': 'Overridden Weekly'}
        }
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, 201)

        # call occurrences endpoint
        occ_url = reverse('task-occurrences')
        resp2 = self.client.get(occ_url + f'?start={start.isoformat()}&end={(start+timedelta(days=21)).isoformat()}')
        self.assertEqual(resp2.status_code, 200)
        # override should appear on one occurrence
        titles = [o['title'] for o in resp2.data]
        self.assertIn('Overridden Weekly', titles)
