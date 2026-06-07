# Implementation Plan — TaskManager (POC)

This document lists the implementation steps, current status, what was done in each step, key files created/modified, and next actions.

## Overview (high-level steps)
1. Scaffold Django + DRF project (repo, venv, requirements)
2. Implement models & migrations (`Task`, `Tag`, `RecurrenceException`)
3. Auth API & user flows (register/login/logout/me)
4. Recurrence engine (store RRULE, expansion utils, tests)
5. Tasks API (CRUD, exceptions endpoints, serializers)
6. Frontend scaffold (React + TypeScript) and auth integration
7. Calendar UI: Year/Month/Week/Day views and task modal
8. Integrate recurrence expansion with frontend (occurrences)
9. Analytics API & frontend dashboard (aggregations, charts)
10. Extra features: Quick-add NLP, Focus Timer, Templates
11. Testing & CI (unit, integration, GitHub Actions)
12. Deployment & Postgres migration (Docker, env, scaling)
13. Polish, docs, demo data and final presentation

---

## Step-by-step status and details

### Step 1 — Scaffold Django + DRF project
- Status: Completed
- What was done:
  - Created Python dependency manifest and `.gitignore`.
  - Created `backend/` Django project with `manage.py`, `taskmanager` settings, URLs, and WSGI.
  - Added `core` app scaffold.
- Key files:
  - [requirements.txt](requirements.txt)
  - [.gitignore](.gitignore)
  - [README.md](README.md)
  - [backend/manage.py](backend/manage.py)
  - [backend/taskmanager/settings.py](backend/taskmanager/settings.py)

### Step 2 — Models & migrations
- Status: Completed
- What was done:
  - Implemented normalized models: `Tag`, `Task`, `RecurrenceException`.
  - Registered models in Django admin.
  - Applied migrations (dev and test DBs).
- Key files:
  - [backend/core/models.py](backend/core/models.py)
  - [backend/core/admin.py](backend/core/admin.py)

### Step 3 — Auth API & user flows
- Status: Completed
- What was done:
  - Implemented `Register`, `Login`, `Logout`, and `Me` API views using Django auth/session flow.
  - Added serializers for user registration and user representation.
  - Routed auth endpoints under `/api/auth/`.
  - Dev server started and endpoints available.
- Key files:
  - [backend/core/serializers.py](backend/core/serializers.py)
  - [backend/core/views.py](backend/core/views.py)
  - [backend/core/auth_urls.py](backend/core/auth_urls.py)
  - [backend/taskmanager/urls.py](backend/taskmanager/urls.py)

### Step 4 — Recurrence engine
- Status: Completed
- What was done:
  - Added RRULE storage on `Task.recurrence_rule` and expansion util using `dateutil.rrule`.
  - Implemented `expand_recurring_tasks(tasks, exceptions, start, end)` that returns occurrence objects for a date range and respects `RecurrenceException` entries.
  - Wrote unit tests validating weekly expansion and exception deletion.
- Key files:
  - [backend/core/utils.py](backend/core/utils.py)
  - [backend/core/tests/test_rrule.py](backend/core/tests/test_rrule.py)

### Step 5 — Tasks API (CRUD & exceptions)
- Status: In progress (next)
- Planned work:
  - Complete DRF serializers for write operations (create/update including tag handling and recurrence validation).
  - Add endpoints to create/list exceptions and to delete single occurrences vs entire series.
  - Expose `GET /api/tasks/occurrences/?start=&end=` which currently exists as an action returning expanded occurrences.
- Files to change/add (planned):
  - [backend/core/serializers.py](backend/core/serializers.py) (write serializers)
  - [backend/core/views.py](backend/core/views.py) (exceptions endpoints)

### Step 6 — Frontend scaffold (React + TypeScript)
- Status: Planned
- Plan:
  - Create a small React + TypeScript SPA using Vite or Create React App.
  - Implement auth flows (login/register) using session cookies.
  - Use React Query for data fetching and optimistic updates.

### Step 7 — Calendar UI and Task modal
- Status: Planned
- Plan:
  - Implement Year → Month → Week → Day views (start with Week and Day for POC).
  - Day view will show three priority sections and an empty-space click to open Task modal.

### Step 8 — Wire recurrence to frontend
- Status: Planned
- Plan:
  - Use `/api/tasks/occurrences/?start=&end=` to render occurrences in calendar views.
  - Support editing single occurrence (exceptions) and full series edits.

### Step 9 — Analytics API & dashboard
- Status: Planned
- Plan:
  - Build `GET /api/analytics/` to return aggregated metrics (total, completed, completionRate, tagBreakdown, streaks).
  - Integrate simple charts on frontend using Chart.js or Recharts.

### Step 10 — Extra features
- Status: Planned (post-core)
- Features: natural-language quick-add, streaks/gamification, recurrence templates, focus timer integration, optional peer-sharing.

### Step 11 — Testing & CI
- Status: In progress
- What was done:
  - Added unit tests for recurrence expansion.
  - Plan: add tests for auth endpoints, task CRUD, exceptions, and analytics. Add GitHub Actions to run tests.

### Step 12 — Deployment & Postgres migration
- Status: Planned
- Plan:
  - Add Dockerfiles and docker-compose for local dev with Postgres.
  - Migrate DB to PostgreSQL for staging/production; enable connection pooling and caching (Redis) for analytics.

### Step 13 — Polish, docs, demo data
- Status: Planned
- Plan:
  - Add seed/fixture data, finalize README, prepare demo script and slides.

---

## How to run the backend locally (dev)
1. Create & activate virtualenv

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

2. Run recurrence unit tests (from `backend`):

```powershell
venv\Scripts\python.exe manage.py test core.tests.test_rrule -v 2
```

## Notes & next immediate actions
- Next immediate step I will implement: Step 5 — finalize Task serializers, add exceptions endpoints, and add tests for task CRUD.
- If you'd prefer I scaffold the frontend first, tell me and I'll pivot.
