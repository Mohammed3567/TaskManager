from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.dateparse import parse_datetime
from .models import Task, Tag, RecurrenceException
from .serializers import TaskSerializer, TagSerializer
from .utils import expand_recurring_tasks, normalize_occurrence_dt
from rest_framework.views import APIView
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from rest_framework.exceptions import ValidationError
from .serializers import UserSerializer, RegisterSerializer
from .serializers import RecurrenceExceptionSerializer
from .models import RecurrenceException
from django.utils import timezone
import datetime
import re

#testing
class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        get_token(request)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({'detail': 'invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        login(request, user)
        get_token(request)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        get_token(request)
        return Response(UserSerializer(request.user).data)


class CsrfTokenView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = get_token(request)
        return Response({'csrfToken': token})


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Task.objects.filter(user=self.request.user).order_by('-date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def _parse_occurrence(self, request):
        occurrence = request.query_params.get('occurrence') or request.data.get('occurrence_date')
        if not occurrence:
            raise ValidationError('occurrence query parameter or occurrence_date field required')
        if ' ' in occurrence and 'T' in occurrence:
            occurrence = occurrence.replace(' ', '+')
        occ_dt = parse_datetime(occurrence)
        if occ_dt is None:
            raise ValidationError('invalid occurrence datetime')
        return normalize_occurrence_dt(occ_dt)

    def _find_exception(self, task, occ_dt):
        occ_n = normalize_occurrence_dt(occ_dt)
        for exc in task.exceptions.all():
            if normalize_occurrence_dt(exc.occurrence_date) == occ_n:
                return exc
        return None

    def _save_instance_exception(self, task, request, delete_only=False):
        if not task.is_recurring:
            raise ValidationError('cannot manage instance exceptions for non-recurring tasks')
        occ_dt = self._parse_occurrence(request)
        exception = self._find_exception(task, occ_dt)
        if exception is None:
            exception = RecurrenceException.objects.create(task=task, occurrence_date=occ_dt)
        elif exception.occurrence_date != occ_dt:
            exception.occurrence_date = occ_dt
        if delete_only:
            exception.is_deleted = True
            exception.override_data = None
        else:
            exception.is_deleted = False
            override_data = request.data.get('override_data')
            if override_data is None:
                allowed = ['title', 'description', 'date', 'end_date', 'duration_minutes', 'all_day', 'timezone', 'priority', 'status', 'is_recurring', 'recurrence_rule']
                override_data = {k: v for k, v in request.data.items() if k in allowed}
            # normalize legacy status values in override data
            override_data = override_data or {}
            if isinstance(override_data, dict) and override_data.get('status') == 'DONE':
                override_data['status'] = 'COMPLETED'
            # Merge into existing override data so previously saved fields
            # (edited date, title, priority, …) are never discarded.
            existing = exception.override_data or {}
            exception.override_data = {**existing, **override_data}
        exception.save()
        return exception

    @action(detail=False, methods=['get'], url_path='occurrences')
    def occurrences(self, request):
        """Return expanded occurrences for the authenticated user's tasks within a date range.

        Query params: start=ISO_DATE, end=ISO_DATE
        """
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        if not start or not end:
            return Response({'detail': 'start and end query params required'}, status=400)

        try:
            # URL encoding may convert '+' to space; restore it for ISO offsets like +00:00
            if ' ' in start and 'T' in start:
                start = start.replace(' ', '+')
            if ' ' in end and 'T' in end:
                end = end.replace(' ', '+')
            start_dt = parse_datetime(start)
            end_dt = parse_datetime(end)
            if start_dt is None or end_dt is None:
                raise ValueError('Invalid datetime')
        except Exception:
            return Response({'detail': 'invalid date format; use ISO datetime'}, status=400)

        tasks = Task.objects.filter(user=request.user)
        exceptions = RecurrenceException.objects.filter(task__in=tasks)

        occurrences = expand_recurring_tasks(tasks, exceptions, start_dt, end_dt)
        return Response(occurrences)

    def update(self, request, *args, **kwargs):
        if request.query_params.get('mode') == 'instance':
            task = self.get_object()
            exception = self._save_instance_exception(task, request, delete_only=False)
            serializer = RecurrenceExceptionSerializer(exception)
            return Response(serializer.data)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if request.query_params.get('mode') == 'instance':
            task = self.get_object()
            exception = self._save_instance_exception(task, request, delete_only=False)
            serializer = RecurrenceExceptionSerializer(exception)
            return Response(serializer.data)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.query_params.get('mode') == 'instance':
            task = self.get_object()
            self._save_instance_exception(task, request, delete_only=True)
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get', 'post'], url_path='exceptions')
    def exceptions(self, request, pk=None):
        task = self.get_object()
        if request.method == 'GET':
            exceptions = task.exceptions.all().order_by('occurrence_date')
            serializer = RecurrenceExceptionSerializer(exceptions, many=True)
            return Response(serializer.data)

        # POST create exception for this task
        data = request.data.copy()
        data['task'] = str(task.id)
        serializer = RecurrenceExceptionSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(task=task)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RecurrenceExceptionViewSet(viewsets.ModelViewSet):
    serializer_class = RecurrenceExceptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # only exceptions for tasks owned by the user
        return RecurrenceException.objects.filter(task__user=self.request.user)

    def perform_create(self, serializer):
        task = serializer.validated_data.get('task')
        if task.user != self.request.user:
            raise permissions.PermissionDenied('Cannot create exception for tasks you do not own')
        serializer.save()


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class AnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # optional start/end query params (ISO datetimes)
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        try:
            if not start:
                end_dt = timezone.now()
                start_dt = end_dt - datetime.timedelta(days=30)
            else:
                if ' ' in start and 'T' in start:
                    start = start.replace(' ', '+')
                if ' ' in end and 'T' in end:
                    end = end.replace(' ', '+')
                start_dt = parse_datetime(start) if start else (timezone.now() - datetime.timedelta(days=30))
                end_dt = parse_datetime(end) if end else timezone.now()
            if start_dt is None or end_dt is None:
                raise ValueError('Invalid datetime')
        except Exception:
            return Response({'detail': 'invalid date format; use ISO datetime'}, status=400)

        tasks = Task.objects.filter(user=request.user)
        exceptions = RecurrenceException.objects.filter(task__in=tasks)
        occurrences = expand_recurring_tasks(tasks, exceptions, start_dt, end_dt)

        total = len(occurrences)
        completed = sum(1 for o in occurrences if o.get('status') == 'COMPLETED')
        completion_rate = round((completed / total) * 100, 2) if total > 0 else 0

        by_priority = {}
        for o in occurrences:
            p = o.get('priority') or 'UNKNOWN'
            by_priority[p] = by_priority.get(p, 0) + 1

        # tag counts (by tasks)
        tag_counts = {}
        for t in tasks:
            for tag in t.tags.all():
                tag_counts[tag.name] = tag_counts.get(tag.name, 0) + 1

        # compute current completion streak (consecutive days with at least one completed occurrence)
        completed_dates = set()
        for o in occurrences:
            if o.get('status') == 'COMPLETED':
                dt = parse_datetime(o.get('date'))
                if dt:
                    completed_dates.add(dt.date())

        streak = 0
        today = timezone.now().date()
        d = today
        while d in completed_dates:
            streak += 1
            d = d - datetime.timedelta(days=1)

        return Response({
            'total_occurrences': total,
            'completed_occurrences': completed,
            'completion_rate_percent': completion_rate,
            'by_priority': by_priority,
            'tag_counts': tag_counts,
            'current_streak_days': streak,
        })


