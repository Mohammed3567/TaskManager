# Technical Design Document (TDD) - TaskManager

## 1. Overview
This document is the canonical technical blueprint for the TaskManager application, aligned to a POC-first implementation using Django and SQLite. It documents the system architecture, data model, API contracts, recurrence strategy, analytics design, and recommended features.

## 2. Technology Stack & Justification (POC-first)
- Backend: **Django 4.x** + **Django REST Framework (DRF)** — rapid scaffolding, integrated auth, admin, migrations, robust ORM.
- Database: **SQLite** for POC; migrate to **PostgreSQL** for staging/production.
- Frontend: **React + TypeScript** SPA (consumes DRF APIs). Optionally Next.js for SSR later.
- Recurrence & date handling: **python-dateutil (rrule)** + **pytz** / Django timezone utilities.
- Testing: Django Test framework + `pytest-django` (optional).

## 3. High-level Architecture
- Presentation: React SPA (calendar views, task modal, analytics). Communicates with DRF API.
- API Layer: DRF views/serializers for auth, tasks, exceptions, tags, analytics.
- Data Layer: Django ORM models backed by SQLite (POC) or PostgreSQL (production).

## 4. Database Design (Django models)
Normalized models for clarity and analytics. Store recurrence rules as RRULE strings; store datetimes in UTC.

`models.py` (sketch)

```python
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()

class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64, unique=True)

class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    date = models.DateTimeField()  # stored in UTC
    priority = models.CharField(max_length=20, choices=[('CRITICAL','CRITICAL'),('IMPORTANT','IMPORTANT'),('ROUTINE','ROUTINE')])
    tags = models.ManyToManyField(Tag, blank=True, related_name='tasks')
    status = models.CharField(max_length=10, choices=[('PENDING','PENDING'),('COMPLETED','COMPLETED')], default='PENDING')
    is_recurring = models.BooleanField(default=False)
    recurrence_rule = models.TextField(blank=True, null=True)  # RRULE
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class RecurrenceException(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='exceptions')
    occurrence_date = models.DateTimeField()  # UTC
    is_deleted = models.BooleanField(default=False)
    override_data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

Notes:
- `RecurrenceException` supports per-occurrence deletes and overrides (edit one occurrence without changing the series).
- Tags are normalized for easy aggregation and indexing.

## 5. API Endpoint Design (DRF)

### Authentication
- `POST /api/auth/register/` — create user, return session cookie.
- `POST /api/auth/login/` — authenticate, create session cookie.
- `POST /api/auth/logout/` — logout, clear session.
- `GET /api/auth/me/` — current user details.

### Tasks & Recurrence
- `GET /api/tasks/?start=YYYY-MM-DD&end=YYYY-MM-DD` — returns expanded occurrences and normal tasks for range.
- `POST /api/tasks/` — create task; payload may include `recurrence_rule` (RRULE string).
- `PUT /api/tasks/{id}/` — update series-wide fields.
- `DELETE /api/tasks/{id}/?mode=series|instance&occurrence=ISO_TS` — delete series or single occurrence.

### Recurrence Exceptions (single-occurrence edits)
- `POST /api/tasks/{id}/exceptions/` — create exception (delete or override an occurrence).
- `GET /api/tasks/{id}/exceptions/` — list exceptions for a task.

### Tags
- `GET /api/tags/` — list tags.
- `POST /api/tags/` — create tag.

### Analytics
- `GET /api/analytics/?type=weekly|monthly&date=YYYY-MM-DD` — returns aggregated metrics:
  - totalTasks, completedTasks, completionRate
  - tagBreakdown: [{tag, total, completed}]
  - streaks, averageFocusSessionLength (if focus timer used)
  - bannerMessage (based on completionRate thresholds)

## 6. Recurrence Expansion: Algorithm & Performance
When a client requests tasks for a date range:
1. Query non-recurring `Task` rows whose `date` falls in the range.
2. Query recurring `Task` rows with `is_recurring=True` and `created_at <= range_end`.
3. For each recurring task, use `dateutil.rrule.rrulestr(recurrence_rule, dtstart=task.date)` to generate occurrences bounded to the requested range.
4. Apply `RecurrenceException` records to remove or alter specific occurrences.
5. Return a merged list of occurrence objects and ad-hoc occurrences with references to their parent task.

Performance considerations:
- Limit expansions strictly to the requested window (no unbounded expansions).
- Paginate returned occurrence lists if necessary for large ranges.
- Cache expanded occurrences for short durations when repeated queries are common.

## 7. Timezone Handling
- Set `USE_TZ = True` in Django settings. Store datetimes in UTC.
- Clients should send dates/times in ISO 8601 with offset or specify timezone in request headers. The server converts and stores UTC.
- When presenting dates, convert to client/local timezone in the frontend.

## 8. Analytics Design
- Use Django ORM annotations to compute aggregations, combined with expanded occurrence lists for recurring tasks.
- Example: completionRate = completed / total * 100.
- Tag distributions computed by joining `Tag` → `Task` relationships and grouping by tag.

## 9. UI & Frontend Architecture
- Keep frontend minimal for POC: a small React SPA with routes:
  - `/login`, `/register`
  - `/` → week view (default)
  - `/day/YYYY-MM-DD` → day view with 3 priority sections
  - `/analytics` → analytics dashboard
- Use React Query (TanStack) for API data fetching and optimistic updates.

## 10. Testing Strategy
- Unit tests for recurrence expansion and exception application.
- Integration tests for API endpoints using Django `APITestCase` or `pytest-django`.
- Frontend component tests for the day view and task modal.

## 11. Security Considerations
- Use Django's CSRF protections and session cookies for the POC.
- Enforce HTTPS in production and set secure cookie attributes.
- Add rate-limiting on API endpoints for production readiness.

## 12. Deployment & Migration Path
- POC: Deploy Django app with SQLite for demos (single-instance). For team demos, deploy to a single VM or Heroku-like host.
- Production: migrate DB to PostgreSQL, add caching (Redis), and configure horizontal scaling for the API and React frontend.

## 13. Recommended Unique Features (priority order)
1. Natural-language quick-add with RRULE parsing.
2. Streaks, badges, and small gamification elements.
3. Saveable recurrence templates.
4. Focus Timer integration for per-task focus sessions and analytics.
5. Adaptive Priority Assistant: basic heuristic suggestions to reprioritize tasks.

## 14. Next Implementation Steps
1. Scaffold Django + DRF project with the models above.
2. Implement recurrence expansion API and unit tests.
3. Scaffold minimal React SPA and wire the `GET /api/tasks` week view.
4. Iterate: add exceptions, tags UI, analytics endpoint, and gamification elements.

## 15. Appendix: Example RRULE use
Use `dateutil.rrule` to convert RRULE strings into occurrences bounded to the requested interval. Keep `dtstart` consistent with stored `Task.date`.

---

This TDD replaces the earlier Node/Prisma design for the POC stage and provides a clear migration path to PostgreSQL and any future architecture choices.

## **Implementation Progress (live workspace snapshot)**

- **Status:** POC backend + frontend implemented, auth gated, recurrence expansion and exceptions supported, calendar-first UI (Month/Week/Day) scaffolded and tested locally.
- **Completed key changes:**
  - **Backend:** recurrence expansion, exceptions model and endpoints; DB migrations applied; session-based auth endpoints implemented.
  - **Frontend:** React + TypeScript SPA with `AuthPage`, `MonthView`, `WeekView`, `DayView`, `TaskModal`, and `ConfirmationDialog`.
  - **Diagnostics & stability:** `ErrorBoundary` and client logging helpers added; defensive patches to calendar components to remove runtime errors.

## **Files changed (work to reference next session)**
- **Frontend**
  - [frontend/src/App.tsx](../frontend/src/App.tsx) — app root, auth gating, view switching, session check, wiring of ErrorBoundary and logging.
  - [frontend/src/api.ts](../frontend/src/api.ts) — API client, `credentials: 'include'`, CSRF header support added for POST/PUT/exception calls.
  - [frontend/src/components/MonthView.tsx](../frontend/src/components/MonthView.tsx) — month grid, defensive guards and diagnostics logging.
  - [frontend/src/components/WeekView.tsx](../frontend/src/components/WeekView.tsx) — week grid; fixed `arguments[0]` bug and defensive grouping of occurrences.
  - [frontend/src/components/DayView.tsx](../frontend/src/components/DayView.tsx) — day view scaffold (unchanged by this session but present in UI).
  - [frontend/src/components/TaskModal.tsx](../frontend/src/components/TaskModal.tsx) — create/edit modal, occurrence override & delete flows.
  - [frontend/src/components/ConfirmationDialog.tsx](../frontend/src/components/ConfirmationDialog.tsx) — modal with subtle open/close transition styles.
  - [frontend/src/components/ErrorBoundary.tsx](../frontend/src/components/ErrorBoundary.tsx) — global React error boundary.
  - [frontend/src/components/clientLogging.ts](../frontend/src/components/clientLogging.ts) — lightweight client logging helper.
  - [frontend/tests/e2e/register_login_create.spec.ts](../frontend/tests/e2e/register_login_create.spec.ts) — Playwright E2E scaffold (register → login → create → occurrences).

- **Backend / utilities**
  - [backend/create_sample_tasks.py](../backend/create_sample_tasks.py) — management script to seed a recurring task + exceptions for QA.
  - `taskmanager/settings.py` — CORS and CSRF trusted origins configured for `http://localhost:5173` (dev convenience).

## **What I ran & quick verification steps**
- Seeded sample recurring data (run inside project venv):

```powershell
c:\Users\hatim\Code\TaskManager\venv\Scripts\python.exe backend/create_sample_tasks.py
```

- Verified in-browser UI (dev servers running):
  - Open: `http://localhost:5173/` → register/login flow → shows "Signed in as <user>".
  - Click `Prev` / `Next` to load month occurrences (server expands recurrences for the month range).
  - Switch to **Week** view — fixed bug so Week view renders; click hour slot or occurrence to open `TaskModal`.
  - Create/Update calls from the UI include `X-CSRFToken` header when available so SessionAuthentication works.

## **Known issues & decisions made**
- Fixed runtime TypeError in `MonthView` and `WeekView` (was calling non-function via `arguments[0]` usage and unguarded prop calls).
- CSRF: UI now includes `X-CSRFToken` when present; the session login flow requires the browser to obtain `csrftoken` and `sessionid` via the normal login flow.
- Validation: quick POSTs from the console may return `400` if required fields (like `priority`) are missing — this is by design; consider sensible server defaults if desired.

## **Immediate next steps (pick up next session)**
- Add a backend endpoint to receive client logs and wire `clientLogging` to POST to it (todo: `backend/logs/`).
- Run and fix Playwright E2E tests end-to-end and add CI job to run on PRs.
- Polish UI: add ErrorBoundary-friendly fallbacks, small animations, replace emoji/icons with inline SVGs, and finish small UX polish items.
- Add more QA fixtures and an idempotent management command to seed varied recurring patterns.

## **How to resume quickly (developer checklist)**
- Start backend in venv: `venv\\Scripts\\Activate.ps1` then `python manage.py runserver`.
- Start frontend dev server: `npm install` (if needed) and `npm run dev` in the `frontend` folder (or `pnpm`/`yarn` as used in your setup).
- Seed sample data (optional, recommended): run `backend/create_sample_tasks.py` with the project venv Python.
- Open `http://localhost:5173/`, sign in, and exercise `Month` / `Week` / `Day` views.

## **Where to look first when you return**
- UI crash or empty state: check browser console logs and the ErrorBoundary logs (client logs appear in the browser console). The `frontend/src/api.ts` and `frontend/src/components/*View.tsx` files are the first places to inspect.
- Backend recurrence issues: `backend/core/utils.py` (recurrence expansion) and the `TaskViewSet.occurrences` endpoint.

---

Add this file to your bookmarks. If you want, I can also create a short `README_NEXT_STEPS.md` summarizing the exact commands I ran and the locations of the most important files.
