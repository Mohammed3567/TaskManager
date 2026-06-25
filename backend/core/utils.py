from dateutil.rrule import rrulestr
from dateutil.parser import parse as parse_dt
from django.utils import timezone
import datetime
import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
logger = logging.getLogger(__name__)


def normalize_occurrence_dt(dt):
    """Normalize occurrence datetimes to UTC with no sub-second precision."""
    if dt is None:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc).replace(microsecond=0)


def occurrence_to_dict(task, occ_dt, exception_override=None):
    d = {
        'task_id': str(task.id),
        'title': task.title,
        'date': occ_dt.isoformat(),
        'occurrence_date': occ_dt.isoformat(),
        'original_occurrence_date': occ_dt.isoformat(),
        'priority': task.priority,
        'status': task.status,
        'is_recurring': task.is_recurring,
    }
    if exception_override:
        # normalize legacy status in exception overrides
        if isinstance(exception_override, dict) and exception_override.get('status') == 'DONE':
            exception_override = dict(exception_override)
            exception_override['status'] = 'COMPLETED'
        d.update(exception_override)
    # normalize any legacy status in the resulting occurrence dict
    if d.get('status') == 'DONE':
        d['status'] = 'COMPLETED'
    return d


def expand_recurring_tasks(tasks, exceptions_qs, range_start, range_end):
    """Expand recurring tasks into occurrences between range_start and range_end.

    tasks: queryset or iterable of Task
    exceptions_qs: queryset of RecurrenceException
    returns: list of dict occurrences
    """
    def _normalize(dt):
        return normalize_occurrence_dt(dt)

    def _task_zone(task):
        try:
            return ZoneInfo(task.timezone or 'UTC')
        except ZoneInfoNotFoundError:
            return ZoneInfo('UTC')

    exceptions_map = {}
    for e in exceptions_qs:
        occ = _normalize(e.occurrence_date)
        if occ is None:
            continue
        key = (str(e.task_id), int(occ.timestamp()))
        exceptions_map[key] = e

    logger.debug('exceptions_map keys: %s', list(exceptions_map.keys()))

    occurrences = []
    for task in tasks:
        # non-recurring tasks: if in range, add
        if not task.is_recurring:
            dt = _normalize(task.date)
            rs = _normalize(range_start)
            re = _normalize(range_end)
            if dt is None:
                continue
            if rs <= dt <= re:
                key = (str(task.id), int(dt.timestamp()))
                exc = exceptions_map.get(key)
                if exc and exc.is_deleted:
                    continue
                override = exc.override_data if exc else None
                occurrences.append(occurrence_to_dict(task, dt, override))
            continue

        # recurring task: expand using rrulestr with dtstart
        if not task.recurrence_rule:
            continue
        if 'FREQ=MONTHLY' in task.recurrence_rule.upper():
            continue
        try:
            task_tz = _task_zone(task)
            dtstart = _normalize(task.date)
            rs = _normalize(range_start)
            re = _normalize(range_end)
            logger.debug('expanding task %s dtstart %s rs %s re %s rule %s', task.id, dtstart, rs, re, task.recurrence_rule)
            local_dtstart = dtstart.astimezone(task_tz)
            local_rs = rs.astimezone(task_tz)
            local_re = re.astimezone(task_tz)
            rule = rrulestr(task.recurrence_rule, dtstart=local_dtstart)
            occs = rule.between(local_rs, local_re, inc=True)
            logger.debug('task %s generated occs: %s', task.id, [o.isoformat() for o in occs])
            for occ in occs:
                occ_n = _normalize(occ.astimezone(datetime.timezone.utc))
                if occ_n is None:
                    continue
                key = (str(task.id), int(occ_n.timestamp()))
                exc = exceptions_map.get(key)
                if exc and exc.is_deleted:
                    continue
                override = exc.override_data if exc else None
                occurrences.append(occurrence_to_dict(task, occ_n, override))
        except Exception:
            # skip malformed rules
            continue

    # sort by date
    occurrences.sort(key=lambda x: x['date'])
    return occurrences
