# Proof of Concept (POC) - TaskManager

## 1. Introduction
TaskManager is a calendar-first task management application that helps users organize time and priorities using a nested visual hierarchy (Year → Month → Week → Day). The POC focuses on implementing a minimal, robust feature set quickly so we can validate the UX, recurrence model, and analytics.

## 2. Purpose / Abstract
The POC demonstrates core functionality: secure authentication, calendar navigation, task CRUD with recurrence, a three-tier daily priority system, and analytics. The implementation will prioritize rapid iteration and clarity of data models so the project can transition from prototype (SQLite) to production (PostgreSQL) later with minimal schema changes.

## 3. Stack & Rationale (POC-first)
- Backend: **Django 4.x + Django REST Framework (DRF)** — batteries-included, fast to scaffold, strong ORM and auth.
- Database (POC): **SQLite** — zero setup for demos and local development.
- Production DB (future): **PostgreSQL** — migrate when scaling or using Postgres-specific features.
- Frontend: **React + TypeScript** (small SPA) that consumes DRF APIs. You may also use Next.js if preferred, but a decoupled React SPA is simplest for the POC.
- Recurrence handling: **python-dateutil (rrule)** for parsing and expanding RRULEs.

## 4. Key POC Goals
- Implement `Task` model with recurrence rule (RRULE) storage and exceptions.
- Expand recurring tasks server-side for requested date ranges (bounded expansion).
- Provide REST endpoints for tasks, exceptions, auth, and analytics.
- Normalize tags via a `Tag` model (ManyToMany) to simplify analytics.
- Deliver a small frontend page to view a week/day, create tasks, and mark complete.

## 5. Unique features to include in the POC
These features help TaskManager stand out early and are feasible within the POC scope:
- Smart Quick-Add (natural language parsing): accept short phrases like "Gym every Mon/Wed 18:00" and synthesize a task + RRULE.
- Streaks and lightweight gamification: show completion streaks per day/week and simple badges for milestones.
- Saveable recurrence templates: allow users to create and reuse recurrence templates (e.g., "Study: Mon/Wed/Fri").
- Focus Timer integration (basic): a Pomodoro timer that attaches to a task and records sessions for analytics.

## 6. Limitations and migration plan
- SQLite is single-writer and not suitable for high-concurrency production; for production migrate to PostgreSQL.
- Avoid SQLite-specific or Postgres-specific column types in early models to make migrations straightforward.

## 7. Deliverables for the POC
- Minimal Django project with DRF endpoints and models: `User`, `Tag`, `Task`, `RecurrenceException`.
- Scripted sample data and fixtures for demo accounts.
- Small React frontend to view weekly tasks, create tasks, and mark completion.
- Unit tests for recurrence expansion and analytics aggregation.

## 8. Next steps (after POC)
1. Migrate DB to PostgreSQL and add production settings (connection pooling, indexes).
2. Add richer analytics visualizations and caching layers.
3. Explore optional ML-powered priority suggestions and smarter scheduling.

## 9. Conclusion
Using Django + SQLite for the POC accelerates development while retaining a clear migration path to PostgreSQL for production. The recommended unique features give TaskManager clear value differentiation early on.
