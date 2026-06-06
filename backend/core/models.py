import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64, unique=True)

    def __str__(self):
        return self.name


class Task(models.Model):
    PRIORITY_CHOICES = [
        ('CRITICAL', 'CRITICAL'),
        ('IMPORTANT', 'IMPORTANT'),
        ('ROUTINE', 'ROUTINE'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'PENDING'),
        ('COMPLETED', 'COMPLETED'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    date = models.DateTimeField()
    # optional end datetime or duration in minutes
    end_date = models.DateTimeField(blank=True, null=True)
    duration_minutes = models.IntegerField(blank=True, null=True)
    all_day = models.BooleanField(default=False)
    timezone = models.CharField(max_length=64, default='UTC')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    tags = models.ManyToManyField(Tag, blank=True, related_name='tasks')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    is_recurring = models.BooleanField(default=False)
    recurrence_rule = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.user})"


class RecurrenceException(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='exceptions')
    occurrence_date = models.DateTimeField()
    is_deleted = models.BooleanField(default=False)
    override_data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('task', 'occurrence_date')
