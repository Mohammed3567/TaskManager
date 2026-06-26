from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import datetime, timedelta
from core.models import Task, RecurrenceException


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

    def test_task_exceptions_action_endpoint(self):
        start = timezone.make_aware(datetime(2026, 6, 1, 9))
        task = Task.objects.create(
            user=self.user,
            title='Recurring Task',
            date=start,
            priority='IMPORTANT',
            is_recurring=True,
            recurrence_rule='FREQ=DAILY;COUNT=5'
        )

        url = reverse('task-exceptions', kwargs={'pk': task.id})
        payload = {
            'occurrence_date': (start + timedelta(days=2)).isoformat(),
            'is_deleted': True
        }
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(RecurrenceException.objects.filter(task=task).count(), 1)

        get_resp = self.client.get(url)
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(len(get_resp.data), 1)
        self.assertEqual(get_resp.data[0]['is_deleted'], True)

    def test_update_instance_exception_via_task_update(self):
        start = timezone.make_aware(datetime(2026, 6, 1, 9))
        task = Task.objects.create(
            user=self.user,
            title='Daily Task',
            date=start,
            priority='IMPORTANT',
            is_recurring=True,
            recurrence_rule='FREQ=DAILY;COUNT=5'
        )

        url = reverse('task-detail', kwargs={'pk': task.id})
        occurrence = (start + timedelta(days=1)).isoformat()
        payload = {
            'override_data': {'title': 'Changed once'}
        }
        resp = self.client.put(url + f'?mode=instance&occurrence={occurrence}', payload, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['override_data']['title'], 'Changed once')
        self.assertEqual(RecurrenceException.objects.filter(task=task).count(), 1)

    def test_delete_instance_via_task_destroy(self):
        start = timezone.make_aware(datetime(2026, 6, 1, 9))
        task = Task.objects.create(
            user=self.user,
            title='Daily Task',
            date=start,
            priority='IMPORTANT',
            is_recurring=True,
            recurrence_rule='FREQ=DAILY;COUNT=5'
        )

        url = reverse('task-detail', kwargs={'pk': task.id})
        occurrence = (start + timedelta(days=2)).isoformat()
        resp = self.client.delete(url + f'?mode=instance&occurrence={occurrence}')
        self.assertEqual(resp.status_code, 204)
        exc = RecurrenceException.objects.get(task=task)
        self.assertTrue(exc.is_deleted)
        self.assertIsNone(exc.override_data)

    def test_save_series_clears_occurrence_overrides(self):
        """Save Series must update occurrences previously edited with Save Occurrence."""
        start = timezone.make_aware(datetime(2026, 6, 1, 9))
        task = Task.objects.create(
            user=self.user,
            title='Original Title',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=DAILY;COUNT=4',
        )

        url = reverse('task-detail', kwargs={'pk': task.id})
        occ_url = reverse('task-occurrences')
        range_end = (start + timedelta(days=4)).isoformat()

        # Save Occurrence on occurrence 2 (individually edited)
        occ2 = (start + timedelta(days=1)).isoformat()
        resp = self.client.put(
            url + f'?mode=instance&occurrence={occ2}',
            {'override_data': {'title': 'Occurrence 2 edit', 'priority': 'IMPORTANT'}},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)

        # Save Occurrence on occurrence 4 (individually edited)
        occ4 = (start + timedelta(days=3)).isoformat()
        resp = self.client.put(
            url + f'?mode=instance&occurrence={occ4}',
            {'override_data': {'title': 'Occurrence 4 edit', 'priority': 'CRITICAL'}},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)

        # Both overrides exist
        self.assertEqual(RecurrenceException.objects.filter(task=task, is_deleted=False).count(), 2)

        # Now Save Series with a new title
        resp = self.client.patch(
            url,
            {'title': 'Updated Series Title', 'priority': 'IMPORTANT',
             'date': start.isoformat(), 'recurrence_rule': 'FREQ=DAILY;COUNT=4'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['title'], 'Updated Series Title')

        # All non-deleted exceptions must have their series-controlled override_data cleared
        for exc in RecurrenceException.objects.filter(task=task, is_deleted=False):
            data = exc.override_data or {}
            self.assertNotIn('title', data, 'title override should be cleared by Save Series')
            self.assertNotIn('priority', data, 'priority override should be cleared by Save Series')

        # Occurrences endpoint must now show the series title for every occurrence
        resp2 = self.client.get(occ_url + f'?start={start.isoformat()}&end={range_end}')
        self.assertEqual(resp2.status_code, 200)
        titles = [o['title'] for o in resp2.data]
        self.assertTrue(
            all(t == 'Updated Series Title' for t in titles),
            f'Expected all occurrences to show series title, got: {titles}',
        )

    def test_save_series_preserves_completion_status(self):
        """Save Series must not reset per-occurrence completion status."""
        start = timezone.make_aware(datetime(2026, 6, 1, 9))
        task = Task.objects.create(
            user=self.user,
            title='Original Title',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=DAILY;COUNT=3',
        )

        url = reverse('task-detail', kwargs={'pk': task.id})
        occ_url = reverse('task-occurrences')
        range_end = (start + timedelta(days=3)).isoformat()

        # Complete occurrence 1 via instance update
        occ1 = start.isoformat()
        resp = self.client.put(
            url + f'?mode=instance&occurrence={occ1}',
            {'status': 'COMPLETED'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)

        # Save Series with a new title
        resp = self.client.patch(
            url,
            {'title': 'New Title', 'priority': 'ROUTINE',
             'date': start.isoformat(), 'recurrence_rule': 'FREQ=DAILY;COUNT=3'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)

        # Occurrence 1 must still be COMPLETED
        resp2 = self.client.get(occ_url + f'?start={start.isoformat()}&end={range_end}')
        self.assertEqual(resp2.status_code, 200)
        statuses = {o['occurrence_date'][:10]: o['status'] for o in resp2.data}
        self.assertEqual(statuses.get(start.date().isoformat()), 'COMPLETED',
                         'Completion status must survive a Save Series')

    def test_save_series_preserves_deleted_occurrences(self):
        """Save Series must not restore occurrences that were deleted individually."""
        start = timezone.make_aware(datetime(2026, 6, 1, 9))
        task = Task.objects.create(
            user=self.user,
            title='Original Title',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=DAILY;COUNT=3',
        )

        url = reverse('task-detail', kwargs={'pk': task.id})
        occ_url = reverse('task-occurrences')
        range_end = (start + timedelta(days=3)).isoformat()

        # Delete occurrence 2
        occ2 = (start + timedelta(days=1)).isoformat()
        resp = self.client.delete(url + f'?mode=instance&occurrence={occ2}')
        self.assertEqual(resp.status_code, 204)

        # Save Series
        resp = self.client.patch(
            url,
            {'title': 'New Title', 'priority': 'ROUTINE',
             'date': start.isoformat(), 'recurrence_rule': 'FREQ=DAILY;COUNT=3'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)

        # Deleted exception must still exist and still be is_deleted=True
        exc = RecurrenceException.objects.get(task=task, is_deleted=True)
        self.assertTrue(exc.is_deleted)

        # Only 2 occurrences should appear (occurrence 2 still deleted)
        resp2 = self.client.get(occ_url + f'?start={start.isoformat()}&end={range_end}')
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(len(resp2.data), 2, 'Deleted occurrence must not reappear after Save Series')
