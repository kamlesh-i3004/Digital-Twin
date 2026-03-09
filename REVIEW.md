# Alkapro - Full Project Review

**Date:** 2026-03-06
**Reviewer:** Claude Sonnet 4.6
**Scope:** Frontend (React + TypeScript) + Backend (Flask + MySQL)

---

## CRITICAL BUGS (Fix Immediately)

### 1. Gmail Sync — Broken Response Handling

**Frontend calls `syncGmail()` and immediately tries to read `.created` / `.skipped` from the response, but the backend returns `{status: "started"}` (HTTP 202 — it's async).**

- `frontend/src/pages/Settings.tsx:165` — `result.created` is `undefined` → runtime crash
- `frontend/src/pages/Tasks.tsx:161` — same issue
- `integrationsApi.getGmailSyncStatus()` is defined in `api.ts` but **never called** — the backend polling endpoint exists and is ready

**Fix:** Implement a polling loop after `syncGmail()` that calls `getGmailSyncStatus()` every 2s until `status === "done"` or `"error"`, then display the real `result.created` / `result.skipped`.

---

### 2. `OAUTHLIB_INSECURE_TRANSPORT=1` in Production

`backend/app.py:9` sets this globally. Fine for dev, dangerous if deployed — disables HTTPS requirement for all OAuth flows.

---

## UNUSED BACKEND FEATURES (Built but frontend never calls them)

| Endpoint | File | Frontend Status |
|---|---|---|
| `GET /tasks/predict` (ML forecast) | `routes/tasks.py:191` | No API method, no UI |
| `POST /tasks/query` (NLP intent) | `routes/tasks.py:289` | No API method, no UI |
| `GET /tasks/overdue` | `routes/tasks.py:150` | No API method, no UI |
| `GET /tasks/reminders` | `routes/tasks.py:164` | No API method, no UI |
| `GET/PUT /digest/settings` | `routes/integrations.py:548` | **No UI built at all** |
| `POST /digest/send` | `routes/integrations.py:592` | **No UI built at all** |
| `POST /tasks/<id>/calendar` (single) | `routes/integrations.py:494` | Exists in Tasks.tsx but bulk sync not exposed |

---

## INCOMPLETE FEATURES (Partially wired)

### Gmail Sync — No Progress Feedback
- Backend runs in a background thread and updates `_sync_status[user_id]`
- Frontend has no polling → user sees no feedback whether sync succeeded or failed
- If the background thread crashes after setting `status: "running"`, it **locks forever** — no timeout reset (`routes/integrations.py:268`)

### Weekly Email Digest Settings
- Full backend CRUD exists (`/digest/settings` GET/PUT, `/digest/send` POST)
- `Settings.tsx` has no UI section for digest at all — the feature is invisible to users

### Task Prediction (ML)
- `routes/tasks.py:191` implements sklearn LinearRegression to forecast next week's task count
- Zero frontend exposure — no chart, no card, nothing

---

## TYPE & SCHEMA MISMATCHES

**Validation field mismatch in Tasks.tsx:**
```typescript
// Tasks.tsx:317 — validates `status` field
if (!taskData.title || !taskData.priority || !taskData.status) {
```
Backend doesn't use a `status` field — it uses a `completed` boolean. This validation can reject valid submissions.

**API response structure mismatch:**
- `integrationsApi.syncGmail()` typed as `{status: string}` in `api.ts`
- Backend returns `{status, result: {created, skipped, tasks}, error}` — frontend types are wrong

---

## CODE QUALITY ISSUES

### Backend

| File | Line | Issue | Severity |
|---|---|---|---|
| `routes/integrations.py` | 322 | Groq API call has no timeout — can hang indefinitely | High |
| `routes/integrations.py` | 273 | Silent `except` swallows email parsing errors, no logging | High |
| `routes/tasks.py` | 60 | No pagination on task list — returns ALL tasks; 1000 tasks → frontend dies | High |
| `models.py` | 10 | `datetime.utcnow()` is deprecated/naive; mixed with timezone-aware datetimes elsewhere | Medium |
| `routes/auth.py` | 22 | No email format validation on registration | Medium |
| `routes/tasks.py` | 213 | `import sklearn` inside the route function — imported on every request | Low |
| `helpers.py` | 121 | Streak calculation strips timezone then compares `.date()` — will break on DST boundaries | Medium |

### Frontend

| File | Line | Issue | Severity |
|---|---|---|---|
| `contexts/AuthContext.tsx` | 24 | JWT stored in `localStorage` — XSS-accessible; should use httpOnly cookies | High |
| `pages/Dashboard.tsx` | 109 | `Promise.all` with no partial failure handling — one bad endpoint kills entire dashboard | Medium |
| `pages/Tasks.tsx` | 411 | `calendarLoadingId` state not reset on error — button stays in loading state | Medium |
| `pages/Notes.tsx` | 349 | Action buttons use `opacity-0 group-hover:opacity-100` — invisible to keyboard users (a11y) | Low |
| `services/api.ts` | 25 | No axios timeout set — requests can hang indefinitely | Medium |
| `contexts/AuthContext.tsx` | 29 | Cached `localStorage.user` never refreshed — deleted/suspended users still see stale profile | Medium |

---

## SECURITY

| Issue | Severity |
|---|---|
| JWT in `localStorage` (XSS risk) | High |
| `OAUTHLIB_INSECURE_TRANSPORT=1` globally | High |
| No email verification on registration | Medium |
| No rate limiting on password change per user (only global) | Medium |
| No CSRF protection on mutations | Medium |
| No DB-level unique constraint on `User.email` — race condition possible | Low |

---

## MISSING FEATURES (Neither frontend nor backend has them)

- Task search / full-text filter
- Note categories or tags
- Recurring tasks
- Task subtasks
- Export tasks/notes (CSV/JSON)
- Time tracking per task
- Pagination on task list

---

## Priority Fix Order

### This Week
1. Fix Gmail sync response handling + implement polling loop with progress UI
2. Add axios timeout (30s default)
3. Fix `Tasks.tsx:317` status validation bug
4. Guard `OAUTHLIB_INSECURE_TRANSPORT` behind dev-only env check
5. Move sklearn import to module level in `routes/tasks.py`

### Next Sprint
6. Build the missing Weekly Digest Settings UI
7. Add task list pagination (limit/offset)
8. Wire up `/tasks/predict` to an Analytics card
9. Add NLP query input to the task search bar
10. Fix `calendarLoadingId` reset on error
11. Add `due_today` / `overdue` quick-filter endpoints to the frontend
12. Replace `datetime.utcnow()` with timezone-aware `datetime.now(timezone.utc)`

### Later
- Move JWT to httpOnly cookies
- Email verification on signup
- Add task/note search
- Recurring tasks
- Task subtasks
- Export functionality
