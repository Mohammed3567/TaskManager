from django.contrib import admin
from .models import Task, Tag, RecurrenceException

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'date', 'priority', 'status', 'is_recurring')

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(RecurrenceException)
class RecurrenceExceptionAdmin(admin.ModelAdmin):
    list_display = ('task', 'occurrence_date', 'is_deleted')
