# 🤖 Digital Twin – Full System Design & Flow

**Project:** Your Digital Twin – AI-Powered Personal Assistant  
**Core Vision:** A proactive dashboard assistant that sorts tasks, surfaces daily digests, and fires overdue/deadline alerts — no chat interface needed.  
**Stack:** Flask + MySQL + JWT (Backend) · React 19 + TypeScript + Vite + Tailwind + Radix UI (Frontend)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  React 19 + TypeScript + Vite  (port 5173)                      │
│  Tailwind CSS v3 · Radix UI · Recharts · React Router v7        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ASSISTANT LAYER (new)                                   │   │
│  │  • Daily Digest Card (on Dashboard)                      │   │
│  │  • Smart Auto-Sorted Task List (on Tasks page)           │   │
│  │  • Proactive Toast Alerts (on page load)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP/REST (Axios + JWT Bearer token)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                │
│  Flask 2.x  (port 5000)                                         │
│  Flask-JWT-Extended · Flask-CORS · Flask-SQLAlchemy             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ASSISTANT ENDPOINTS (new/enhanced)                      │   │
│  │  GET /api/assistant/digest   → daily summary             │   │
│  │  GET /api/tasks/recommend    → top focus task            │   │
│  │  GET /api/tasks/overdue      → overdue list              │   │
│  │  GET /api/tasks/reminders    → due within 7 days         │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │  SQLAlchemy ORM
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
│  MySQL (prod) / SQLite (local dev)                              │
│  Tables: user · task · note · google_integration                │
│          gmail_sender_whitelist                                 │
└─────────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   Google Gmail    Google Calendar   Groq LLM API
   (OAuth 2.0)     (OAuth 2.0)       (llama3-8b-8192)
```

---

## 2. The Assistant Experience — Core Design

The Digital Twin acts as a **proactive personal assistant** that does three things automatically every time the user opens the app:

### 2.1 Daily Digest Card (Dashboard)

A prominent card at the top of the Dashboard that greets the user and summarizes their day:

```
┌─────────────────────────────────────────────────────────────┐
│  🌅  Good morning, Kamlesh!                                 │
│  Here's your day at a glance — Friday, 27 Feb 2026          │
│                                                             │
│  ⚠️  3 overdue tasks need your attention                    │
│  📅  5 tasks due today                                      │
│  🔥  2 high-priority tasks pending                          │
│  ✅  You completed 4 tasks yesterday — great work!          │
│                                                             │
│  🎯  Focus on:  "Submit project report"  [High · Due today] │
│                                          [Mark Done] [View] │
└─────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Overdue count → `GET /api/tasks/stats` → `overdue`
- Tasks due today → computed from task list
- High priority pending → computed from task list
- Yesterday's completions → `GET /api/tasks/stats` → `completed_today` (previous day)
- Focus task → `GET /api/tasks/recommend`

### 2.2 Smart Auto-Sorted Task List (Tasks Page)

The Tasks page default sort becomes **"Assistant Priority"** — tasks are automatically ordered by urgency:

```
Priority Order:
  1. 🔴 Overdue (past due_date, not completed)
  2. 🟠 Due Today
  3. 🟡 High Priority (due within 3 days)
  4. 🔵 Medium Priority (due within 7 days)
  5. ⚪ Low Priority / No due date
```

Within each tier, tasks are sorted by `due_date` ascending (earliest first).

The user can still switch to manual sort (by date, priority, created_at) via a dropdown.

### 2.3 Proactive Toast Alerts (On Page Load)

When the user logs in or navigates to the Dashboard, the app fires toast notifications:

| Condition | Toast Type | Message |
|-----------|-----------|---------|
| ≥1 overdue task | 🔴 Error toast | "You have N overdue tasks!" |
| Tasks due today | 🟡 Warning toast | "N tasks are due today" |
| Tasks due tomorrow | 🔵 Info toast | "N tasks are due tomorrow — plan ahead" |
| All caught up | 🟢 Success toast | "You're all caught up! Great work 🎉" |

Alerts fire **once per session** (tracked in `sessionStorage`) to avoid spamming.

---

## 3. New Backend Endpoint: `/api/assistant/digest`

This single endpoint powers the Daily Digest Card. It aggregates all the data the frontend needs in one call:

**Request:** `GET /api/assistant/digest`  
**Auth:** JWT required

**Response:**
```json
{
  "success": true,
  "data": {
    "greeting": "Good morning",
    "overdue_count": 3,
    "due_today_count": 5,
    "due_tomorrow_count": 2,
    "high_priority_pending": 2,
    "completed_yesterday": 4,
    "streak_days": 7,
    "focus_task": {
      "task": { "id": "12", "title": "Submit project report", "priority": "High", "due_date": "2026-02-27", ... },
      "reason": "This task is due today and marked High priority."
    },
    "upcoming_tasks": [
      { "id": "13", "title": "Team meeting prep", "due_date": "2026-02-27", "priority": "Medium" },
      { "id": "14", "title": "Review PR", "due_date": "2026-02-28", "priority": "High" }
    ]
  }
}
```

**Backend logic:**
```python
@app.route("/api/assistant/digest", methods=["GET"])
@jwt_required()
def assistant_digest():
    user_id = get_jwt_identity()
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    yesterday_start = today_start - timedelta(days=1)
    tomorrow_end = today_end + timedelta(days=1)

    # Counts
    overdue_count = Task.query.filter(
        Task.user_id == user_id, Task.completed == False,
        Task.due_date != None, Task.due_date < today_start
    ).count()

    due_today = Task.query.filter(
        Task.user_id == user_id, Task.completed == False,
        Task.due_date >= today_start, Task.due_date < today_end
    ).count()

    due_tomorrow = Task.query.filter(
        Task.user_id == user_id, Task.completed == False,
        Task.due_date >= today_end, Task.due_date < tomorrow_end
    ).count()

    high_priority = Task.query.filter_by(
        user_id=user_id, completed=False, priority="High"
    ).count()

    completed_yesterday = Task.query.filter(
        Task.user_id == user_id, Task.completed == True,
        Task.completed_at >= yesterday_start, Task.completed_at < today_start
    ).count()

    # Greeting based on hour
    hour = now.hour
    greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"

    # Focus task (reuse recommend logic)
    focus = _get_recommendation(user_id, now)

    # Upcoming tasks (next 7 days, max 5)
    upcoming = Task.query.filter(
        Task.user_id == user_id, Task.completed == False,
        Task.due_date >= today_start, Task.due_date <= now + timedelta(days=7)
    ).order_by(Task.due_date).limit(5).all()

    return api_ok({
        "greeting": greeting,
        "overdue_count": overdue_count,
        "due_today_count": due_today,
        "due_tomorrow_count": due_tomorrow,
        "high_priority_pending": high_priority,
        "completed_yesterday": completed_yesterday,
        "focus_task": focus,
        "upcoming_tasks": [serialize_task(t) for t in upcoming],
    })
```

---

## 4. Frontend Changes

### 4.1 Dashboard Page Enhancements

**File:** [`alkapro/frontend/src/pages/Dashboard.tsx`](alkapro/frontend/src/pages/Dashboard.tsx)

**Changes:**
1. Add `DailyDigestCard` component at the top of the page
2. Call `GET /api/assistant/digest` on mount (replaces separate stats + recommend calls)
3. Fire toast alerts based on digest data (once per session via `sessionStorage`)
4. Keep existing stat cards below the digest card

**New component structure:**
```
Dashboard
├── DailyDigestCard          ← NEW (prominent, full-width)
│   ├── Greeting + date
│   ├── Alert badges (overdue, due today, high priority)
│   ├── Yesterday's win message
│   └── Focus Task mini-card with [Mark Done] + [View] buttons
├── StatCards row            ← existing (Total, Completed, Pending, Overdue)
├── QuickActions row         ← existing
└── RecentTasks list         ← existing
```

### 4.2 Tasks Page Enhancements

**File:** [`alkapro/frontend/src/pages/Tasks.tsx`](alkapro/frontend/src/pages/Tasks.tsx)

**Changes:**
1. Add `"assistant"` as the default sort option in the sort dropdown
2. Implement client-side assistant sort function:

```typescript
function assistantSort(tasks: Task[]): Task[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const in3Days = new Date(today.getTime() + 3 * 86400000);
  const in7Days = new Date(today.getTime() + 7 * 86400000);

  const getTier = (task: Task): number => {
    if (task.status === 'completed') return 6;
    const due = task.due_date ? new Date(task.due_date) : null;
    if (due && due < today) return 1;           // overdue
    if (due && due < tomorrow) return 2;        // due today
    if (task.priority === 'High' && due && due < in3Days) return 3;  // high + due soon
    if (due && due < in7Days) return 4;         // due this week
    return 5;                                   // everything else
  };

  return [...tasks].sort((a, b) => {
    const tierDiff = getTier(a) - getTier(b);
    if (tierDiff !== 0) return tierDiff;
    // Within same tier: sort by due_date ascending
    const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return aDate - bDate;
  });
}
```

3. Add visual tier indicators on task cards:
   - 🔴 Red left border = overdue
   - 🟠 Orange left border = due today
   - 🟡 Yellow left border = high priority / due soon
   - Default = no special border

### 4.3 Toast Alert System

**File:** [`alkapro/frontend/src/pages/Dashboard.tsx`](alkapro/frontend/src/pages/Dashboard.tsx) (or a new `useAssistantAlerts` hook)

```typescript
// hooks/useAssistantAlerts.ts
export function useAssistantAlerts(digest: DigestData | null) {
  useEffect(() => {
    if (!digest) return;
    const sessionKey = 'assistant_alerts_shown';
    if (sessionStorage.getItem(sessionKey)) return;

    // Fire alerts with slight delays so they stack nicely
    if (digest.overdue_count > 0) {
      setTimeout(() => toast.error(
        `⚠️ You have ${digest.overdue_count} overdue task${digest.overdue_count > 1 ? 's' : ''}!`,
        { duration: 6000 }
      ), 500);
    }
    if (digest.due_today_count > 0) {
      setTimeout(() => toast.warning(
        `📅 ${digest.due_today_count} task${digest.due_today_count > 1 ? 's' : ''} due today`,
        { duration: 5000 }
      ), 1200);
    }
    if (digest.due_tomorrow_count > 0) {
      setTimeout(() => toast.info(
        `🔔 ${digest.due_tomorrow_count} task${digest.due_tomorrow_count > 1 ? 's' : ''} due tomorrow`,
        { duration: 4000 }
      ), 1900);
    }
    if (digest.overdue_count === 0 && digest.due_today_count === 0) {
      setTimeout(() => toast.success(
        "🎉 You're all caught up! Great work.",
        { duration: 4000 }
      ), 500);
    }

    sessionStorage.setItem(sessionKey, 'true');
  }, [digest]);
}
```

### 4.4 New TypeScript Types

**File:** [`alkapro/frontend/src/types/index.ts`](alkapro/frontend/src/types/index.ts)

```typescript
export interface AssistantDigest {
  greeting: string;
  overdue_count: number;
  due_today_count: number;
  due_tomorrow_count: number;
  high_priority_pending: number;
  completed_yesterday: number;
  streak_days: number;
  focus_task: TaskRecommendation | null;
  upcoming_tasks: Task[];
}
```

### 4.5 New API Service Method

**File:** [`alkapro/frontend/src/services/api.ts`](alkapro/frontend/src/services/api.ts)

```typescript
export const assistantApi = {
  getDigest: async (): Promise<AssistantDigest> => {
    const response = await api.get<ApiResponse<AssistantDigest>>('/assistant/digest');
    return response.data.data;
  },
};
```

---

## 5. Complete User Flow Diagrams

### 5.1 User Opens App (Morning Flow)

```
User navigates to /dashboard
        │
        ▼
AuthContext checks localStorage token
        │
        ├── No token → redirect to /login
        │
        └── Token found → verify via GET /api/profile
                │
                ▼
        Dashboard mounts
                │
                ▼
        GET /api/assistant/digest
                │
                ▼
        ┌───────────────────────────────────┐
        │  DailyDigestCard renders:         │
        │  "Good morning, Kamlesh!"         │
        │  ⚠️ 3 overdue  📅 5 today         │
        │  🎯 Focus: Submit project report  │
        └───────────────────────────────────┘
                │
                ▼
        useAssistantAlerts fires toasts:
          t=0.5s: 🔴 "3 overdue tasks!"
          t=1.2s: 🟡 "5 tasks due today"
          t=1.9s: 🔵 "2 tasks due tomorrow"
                │
                ▼
        sessionStorage.setItem('assistant_alerts_shown', 'true')
        (no more toasts until browser tab closes)
```

### 5.2 User Views Tasks (Smart Sort Flow)

```
User navigates to /tasks
        │
        ▼
GET /api/tasks (all tasks for user)
        │
        ▼
Default sort = "Assistant Priority"
        │
        ▼
assistantSort() runs client-side:
  Tier 1: 🔴 Overdue tasks (sorted by due_date asc)
  Tier 2: 🟠 Due today
  Tier 3: 🟡 High priority due within 3 days
  Tier 4: 🔵 Due this week
  Tier 5: ⚪ Everything else
  Tier 6: ✅ Completed (at bottom)
        │
        ▼
Task cards render with color-coded left borders
User can switch sort via dropdown: [Assistant ▼] [Date] [Priority] [Created]
```

### 5.3 Task Completion Flow

```
User clicks [Mark Done] on Focus Task in Digest Card
        │
        ▼
PATCH /api/tasks/<id>  { "status": "completed" }
        │
        ▼
Backend sets completed=True, completed_at=now
        │
        ▼
Frontend: toast.success("Task completed! ✅")
        │
        ▼
Dashboard re-fetches GET /api/assistant/digest
        │
        ▼
DailyDigestCard updates with new focus task
```

---

## 6. Database Schema (Unchanged)

### 6.1 Entity-Relationship Diagram

```
User (1) ──────< Task (N)
User (1) ──────< Note (N)
User (1) ──────< GoogleIntegration (1)
User (1) ──────< GmailSenderWhitelist (N)
```

### 6.2 Table Definitions

| Table | Column | Type | Constraints |
|-------|--------|------|-------------|
| **user** | id | INT | PK, AUTO_INCREMENT |
| | name | VARCHAR(100) | NOT NULL |
| | email | VARCHAR(200) | UNIQUE, NOT NULL |
| | password | VARCHAR(200) | NOT NULL (hashed) |
| | created_at | DATETIME | DEFAULT utcnow |
| **task** | id | INT | PK, AUTO_INCREMENT |
| | title | VARCHAR(200) | NOT NULL |
| | description | VARCHAR(500) | DEFAULT "" |
| | priority | VARCHAR(20) | DEFAULT "Medium" |
| | category | VARCHAR(50) | DEFAULT "General" |
| | due_date | DATETIME | NULLABLE |
| | created_at | DATETIME | DEFAULT utcnow |
| | completed | BOOLEAN | DEFAULT FALSE |
| | completed_at | DATETIME | NULLABLE |
| | source_email_id | VARCHAR(200) | NULLABLE (Gmail dedup) |
| | user_id | INT | FK → user.id |
| **note** | id | INT | PK, AUTO_INCREMENT |
| | title | VARCHAR(200) | DEFAULT "" |
| | content | TEXT | NOT NULL |
| | created_at | DATETIME | DEFAULT utcnow |
| | updated_at | DATETIME | DEFAULT utcnow |
| | user_id | INT | FK → user.id |
| **google_integration** | id | INT | PK |
| | user_id | INT | FK → user.id, UNIQUE |
| | access_token | TEXT | NOT NULL |
| | refresh_token | TEXT | NULLABLE |
| | token_expiry | DATETIME | NULLABLE |
| | google_email | VARCHAR(200) | NULLABLE |
| | connected_at | DATETIME | DEFAULT utcnow |
| **gmail_sender_whitelist** | id | INT | PK |
| | user_id | INT | FK → user.id |
| | sender_email | VARCHAR(200) | NOT NULL |
| | added_at | DATETIME | DEFAULT utcnow |
| | | | UNIQUE(user_id, sender_email) |

---

## 7. Complete API Endpoint Map

### Auth & Profile
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | ❌ | Register new user |
| POST | `/api/login` | ❌ | Login, returns JWT |
| GET | `/api/profile` | ✅ | Get current user profile |
| PUT/PATCH | `/api/profile` | ✅ | Update name/email |
| POST | `/api/auth/change-password` | ✅ | Change password |
| GET | `/api/health` | ❌ | Health check |

### Assistant (NEW)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/assistant/digest` | ✅ | **Daily digest: greeting, counts, focus task, upcoming** |

### Tasks
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks` | ✅ | List tasks (filter + sort) |
| POST | `/api/tasks` | ✅ | Create task |
| GET | `/api/tasks/<id>` | ✅ | Get single task |
| PUT/PATCH | `/api/tasks/<id>` | ✅ | Update task |
| DELETE | `/api/tasks/<id>` | ✅ | Delete task |
| GET | `/api/tasks/stats` | ✅ | Counts: total, completed, pending, overdue, completed_today |
| GET | `/api/tasks/overdue` | ✅ | List overdue tasks |
| GET | `/api/tasks/reminders` | ✅ | Tasks due within 7 days |
| GET | `/api/tasks/recommend` | ✅ | AI-recommended next task |
| GET | `/api/tasks/predict` | ✅ | ML prediction: tasks next week |

### Notes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notes` | ✅ | List notes |
| POST | `/api/notes` | ✅ | Create note |
| GET | `/api/notes/<id>` | ✅ | Get single note |
| PUT/PATCH | `/api/notes/<id>` | ✅ | Update note |
| DELETE | `/api/notes/<id>` | ✅ | Delete note |

### Analytics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/analytics/tasks/completion?days=N` | ✅ | Daily created vs completed |
| GET | `/api/analytics/tasks/priority` | ✅ | Priority distribution |
| GET | `/api/analytics/productivity` | ✅ | Completion rate, tasks/day, streak |

### NLP Query
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/query` | ✅ | Natural language task query |

### Google Integrations
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/integrations/google/auth-url` | ✅ | Get OAuth2 redirect URL |
| GET | `/api/integrations/google/callback` | ❌ | OAuth2 callback |
| GET | `/api/integrations/google/status` | ✅ | Check connection status |
| DELETE | `/api/integrations/google/disconnect` | ✅ | Disconnect Google |
| GET | `/api/integrations/gmail/senders` | ✅ | List whitelisted senders |
| POST | `/api/integrations/gmail/senders` | ✅ | Add sender |
| DELETE | `/api/integrations/gmail/senders/<email>` | ✅ | Remove sender |
| POST | `/api/integrations/gmail/sync` | ✅ | Gmail → Tasks via Groq LLM |
| POST | `/api/integrations/calendar/sync` | ✅ | Tasks → Google Calendar |

---

## 8. Frontend Route & Component Map

### Routes
```
/                    → Landing (public)
/login               → Login (public)
/register            → Register (public)
/dashboard           → Dashboard (protected) ← ENHANCED with digest + alerts
/tasks               → Tasks (protected) ← ENHANCED with smart sort
/notes               → Notes (protected)
/analytics           → Analytics (protected)
/settings            → Settings (protected)
```

### Component Hierarchy
```
App
├── ThemeProvider
├── AuthProvider
└── Router
    ├── Landing
    ├── Login
    ├── Register
    └── ProtectedRoute → Layout
        ├── Sidebar
        ├── Header
        └── Outlet
            ├── Dashboard
            │   ├── DailyDigestCard  ← NEW
            │   │   ├── GreetingHeader
            │   │   ├── AlertBadges (overdue, today, high-priority)
            │   │   ├── YesterdayWin
            │   │   └── FocusTaskCard
            │   ├── StatCards (existing)
            │   ├── QuickActions (existing)
            │   └── RecentTasks (existing)
            ├── Tasks
            │   ├── AssistantSortToggle  ← NEW
            │   ├── FilterBar (existing)
            │   └── TaskList (enhanced with tier borders)
            ├── Notes
            ├── Analytics
            └── Settings
```

---

## 9. AI/ML Features Summary

| Feature | Location | How It Works |
|---------|----------|-------------|
| Daily Digest | `GET /api/assistant/digest` | Aggregates counts + greeting + focus task in one call |
| Smart Task Recommendation | `GET /api/tasks/recommend` | Rule-based: overdue → high priority → due soon → any pending |
| Assistant Sort | Client-side in Tasks.tsx | Tier-based sort: overdue → today → high+soon → this week → rest |
| Toast Alerts | `useAssistantAlerts` hook | Fires on digest load, once per session via sessionStorage |
| ML Prediction | `GET /api/tasks/predict` | scikit-learn LinearRegression on weekly task counts |
| NLP Query | `POST /api/query` | Keyword intent detection |
| Gmail → Tasks | `POST /api/integrations/gmail/sync` | Groq llama3-8b-8192 classifies emails |

---

## 10. Implementation Plan (Ordered by Priority)

### Phase 1 — Assistant Core (Main Goal)
| # | Task | File(s) |
|---|------|---------|
| 1 | Add `GET /api/assistant/digest` endpoint | [`alkapro/backend/app.py`](alkapro/backend/app.py) |
| 2 | Add `AssistantDigest` type | [`alkapro/frontend/src/types/index.ts`](alkapro/frontend/src/types/index.ts) |
| 3 | Add `assistantApi.getDigest()` | [`alkapro/frontend/src/services/api.ts`](alkapro/frontend/src/services/api.ts) |
| 4 | Build `DailyDigestCard` component | `alkapro/frontend/src/components/assistant/DailyDigestCard.tsx` (new) |
| 5 | Build `useAssistantAlerts` hook | `alkapro/frontend/src/hooks/useAssistantAlerts.ts` (new) |
| 6 | Integrate digest card + alerts into Dashboard | [`alkapro/frontend/src/pages/Dashboard.tsx`](alkapro/frontend/src/pages/Dashboard.tsx) |
| 7 | Add `assistantSort()` function + tier borders to Tasks | [`alkapro/frontend/src/pages/Tasks.tsx`](alkapro/frontend/src/pages/Tasks.tsx) |

### Phase 2 — Deployment Prep
| # | Task | File(s) |
|---|------|---------|
| 8 | Create `.env.example` | `alkapro/backend/.env.example` |
| 9 | Create `Dockerfile` | `alkapro/backend/Dockerfile` |
| 10 | Create `docker-compose.yml` | `alkapro/docker-compose.yml` |
| 11 | Create `Procfile` | `alkapro/backend/Procfile` |
| 12 | Use `VITE_API_URL` env var in frontend | [`alkapro/frontend/src/services/api.ts`](alkapro/frontend/src/services/api.ts) |

### Phase 3 — Testing
| # | Task | File(s) |
|---|------|---------|
| 13 | Pytest suite for all endpoints | `alkapro/backend/tests/` |
| 14 | Test the new digest endpoint | `alkapro/backend/tests/test_assistant.py` |

---

## 11. Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19.x |
| Frontend Language | TypeScript | 5.9.x |
| Frontend Build | Vite | 7.x |
| CSS Framework | Tailwind CSS | 3.4.x |
| UI Components | Radix UI | latest |
| Charts | Recharts | 2.x |
| HTTP Client | Axios | 1.x |
| Routing | React Router | 7.x |
| Forms | React Hook Form + Zod | latest |
| Notifications | Sonner | 2.x |
| Backend Framework | Flask | 2.x |
| Backend Language | Python | 3.10+ |
| ORM | Flask-SQLAlchemy | 2.5+ |
| Auth | Flask-JWT-Extended | 4.x |
| Password Hashing | Werkzeug | 3.x |
| CORS | Flask-CORS | 4.x |
| Database (prod) | MySQL | 8.x |
| Database (dev) | SQLite | built-in |
| ML | scikit-learn + numpy | 1.x |
| LLM | Groq API (llama3-8b-8192) | 0.4+ |
| Google APIs | google-api-python-client | 2.x |
| Config | python-dotenv | 1.x |

---

## 12. Environment Variables

### Backend (`.env`)
```env
DATABASE_URL=mysql+pymysql://root:password@localhost/alkapro
JWT_SECRET_KEY=your-super-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/integrations/google/callback
FRONTEND_URL=http://localhost:5173
GROQ_API_KEY=your-groq-api-key
```

### Frontend (`.env`)
```env
VITE_API_URL=http://127.0.0.1:5000/api
```
