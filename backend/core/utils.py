from dateutil.rrule import rrulestr
from dateutil.parser import parse as parse_dt
from django.utils import timezone
import datetime
import logging
logger = logging.getLogger(__name__)

def occurrence_to_dict(task, occ_dt, exception_override=None):
    d = {
        'task_id': str(task.id),
        'title': task.title,
        'date': occ_dt.isoformat(),
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
        if dt is None:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc).replace(microsecond=0)

    exceptions_map = {}
    for e in exceptions_qs:
        occ = _normalize(e.occurrence_date)
        key = (str(e.task_id), occ.isoformat())
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
                key = (str(task.id), dt.isoformat())
                exc = exceptions_map.get(key)
                if exc and exc.is_deleted:
                    continue
                override = exc.override_data if exc else None
                occurrences.append(occurrence_to_dict(task, dt, override))
            continue

        # recurring task: expand using rrulestr with dtstart
        if not task.recurrence_rule:
            continue
        try:
            dtstart = _normalize(task.date)
            rs = _normalize(range_start)
            re = _normalize(range_end)
            logger.debug('expanding task %s dtstart %s rs %s re %s rule %s', task.id, dtstart, rs, re, task.recurrence_rule)
            rule = rrulestr(task.recurrence_rule, dtstart=dtstart)
            occs = rule.between(rs, re, inc=True)
            logger.debug('task %s generated occs: %s', task.id, [o.isoformat() for o in occs])
            for occ in occs:
                occ_n = _normalize(occ)
                key = (str(task.id), occ_n.isoformat())
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
