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
    # accept legacy 'DONE' value from older clients and normalize to 'COMPLETED'
    status = serializers.CharField(required=False, allow_null=True)

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

    def validate_status(self, value):
        if value is None:
            return value
        # normalize legacy value
        if value == 'DONE':
            return 'COMPLETED'
        valid = [c[0] for c in Task._meta.get_field('status').choices]
        if value not in valid:
            raise serializers.ValidationError('Invalid status')
        return value

    def validate_recurrence_rule(self, value):
        if value and 'FREQ=MONTHLY' in value.upper():
            raise serializers.ValidationError('Monthly recurrence is not supported')
        return value


class RecurrenceExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurrenceException
        fields = ('id', 'task', 'occurrence_date', 'is_deleted', 'override_data', 'created_at')

    def validate_override_data(self, value):
        # normalize legacy status values in override payloads
        if not value:
            return value
        if isinstance(value, dict):
            if value.get('status') == 'DONE':
                value['status'] = 'COMPLETED'
            rule = value.get('recurrence_rule')
            if isinstance(rule, str) and 'FREQ=MONTHLY' in rule.upper():
                raise serializers.ValidationError('Monthly recurrence is not supported')
        return value


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
