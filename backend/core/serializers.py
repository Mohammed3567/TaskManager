from rest_framework import serializers
from .models import Task, Tag, RecurrenceException
from django.contrib.auth import get_user_model
from datetime import timedelta

User = get_user_model()


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ('id', 'name')


class TaskSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Task
        fields = (
            'id', 'user', 'title', 'description', 'date', 'end_date', 'duration_minutes', 'all_day', 'timezone', 'priority', 'tags', 'status', 'is_recurring', 'recurrence_rule', 'created_at', 'updated_at', 'tag_names'
        )
        extra_kwargs = {'user': {'read_only': True}}

    def create(self, validated_data):
        tag_names = validated_data.pop('tag_names', [])
        # compute end_date from duration if provided
        duration = validated_data.get('duration_minutes')
        if duration and 'end_date' not in validated_data:
            start = validated_data.get('date')
            if start:
                validated_data['end_date'] = start + timedelta(minutes=duration)
        task = Task.objects.create(**validated_data)
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(name=name)
            task.tags.add(tag)
        return task

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tag_names', None)
        duration = validated_data.get('duration_minutes')
        if duration and 'end_date' not in validated_data:
            start = validated_data.get('date', instance.date)
            if start:
                validated_data['end_date'] = start + timedelta(minutes=duration)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tag_names is not None:
            instance.tags.clear()
            for name in tag_names:
                tag, _ = Tag.objects.get_or_create(name=name)
                instance.tags.add(tag)
        return instance


class RecurrenceExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurrenceException
        fields = ('id', 'task', 'occurrence_date', 'is_deleted', 'override_data', 'created_at')


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists')
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
