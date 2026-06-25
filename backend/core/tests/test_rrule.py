from django.test import TestCase
from django.contrib.auth import get_user_model
from core.models import Task, RecurrenceException, Tag
from django.utils import timezone
from datetime import datetime, timedelta


class RecurrenceExpansionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='test', password='pass')

    def test_weekly_rrule_expansion(self):
        start = timezone.make_aware(datetime(2026, 6, 1))
        task = Task.objects.create(
            user=self.user,
            title='Weekly Task',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=WEEKLY;COUNT=3'
        )

        from core.utils import expand_recurring_tasks

        end = start + timedelta(days=21)
        occurrences = expand_recurring_tasks([task], RecurrenceException.objects.none(), start, end)
        self.assertEqual(len(occurrences), 3)

    def test_exception_deletes_occurrence(self):
        start = timezone.make_aware(datetime(2026, 6, 1))
        task = Task.objects.create(
            user=self.user,
            title='Weekly Task',
            date=start,
            priority='ROUTINE',
            is_recurring=True,
            recurrence_rule='FREQ=WEEKLY;COUNT=3'
        )
        # delete second occurrence
        second_occ = start + timedelta(weeks=1)
        RecurrenceException.objects.create(task=task, occurrence_date=second_occ, is_deleted=True)

        from core.utils import expand_recurring_tasks

        end = start + timedelta(days=21)
        occurrences = expand_recurring_tasks([task], RecurrenceException.objects.filter(task=task), start, end)
        self.assertEqual(len(occurrences), 2)
