from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.dateparse import parse_datetime
from .models import Task, Tag, RecurrenceException
from .serializers import TaskSerializer, TagSerializer
from .utils import expand_recurring_tasks
from rest_framework.views import APIView
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from .serializers import UserSerializer, RegisterSerializer
from .serializers import RecurrenceExceptionSerializer
from .models import RecurrenceException


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
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
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


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
        except Exception:
            return Response({'detail': 'invalid date format; use ISO datetime'}, status=400)

        tasks = Task.objects.filter(user=request.user)
        exceptions = RecurrenceException.objects.filter(task__in=tasks)

        occurrences = expand_recurring_tasks(tasks, exceptions, start_dt, end_dt)
        return Response(occurrences)


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
