# Project Roadmap

**Digital Twin – AI-Powered Personal Assistant**

A full-stack productivity app with task management, notes, AI recommendations, analytics, and ML predictions.

---

## ✅ Completed

### Backend (Flask + SQLite + JWT)
- User registration & login with hashed passwords (Werkzeug)
- JWT authentication (`Flask-JWT-Extended`)
- User profile: `GET /api/profile`, `PUT /api/profile`
- Password change: `POST /api/auth/change-password`
- Full CORS support (`Flask-CORS`)
- Standardized API responses: `{ success, data, message }`
- **Tasks** – full CRUD with `category`, `status`, `completed_at`, `created_at`
- Task statistics: total, completed, pending, overdue, completed_today
- Smart recommendation engine (overdue → high priority → due soon → any pending)
- Overdue tasks, 7-day reminders
- **ML prediction** (`scikit-learn` LinearRegression) for next-week task estimate
- Improved NLP query endpoint (intent detection: overdue, today, high priority, this week, completed, due tomorrow)
- **Notes** – full CRUD with `updated_at`
- **Analytics endpoints**:
  - `GET /api/analytics/tasks/completion?days=N` – daily created vs completed
  - `GET /api/analytics/tasks/priority` – priority distribution
  - `GET /api/analytics/productivity` – completion rate, tasks/day, streak days

### Frontend (React 19 + TypeScript + Vite + Tailwind + Radix UI)
- Landing page (marketing, auth-aware)
- Auth: Login + Register with validation
- Dashboard: real stats, AI recommendation card, recent tasks
- Tasks: full CRUD, filters (status/priority/category), sort, search
- Notes: full CRUD, search, mobile/desktop views
- Analytics: bar/line/pie charts from real API data
- Settings: profile update, dark/light theme, notification prefs (localStorage), **password change (wired to API)**
- Protected routes, AuthContext, ThemeContext
- Axios API service with interceptors

---

## 📅 Remaining Work

### 1. Deployment Prep
- Add `.env` file support for `JWT_SECRET_KEY` and `DATABASE_URL`
- Write `Dockerfile` for backend containerization
- Write `docker-compose.yml` for local full-stack spin-up
- Add `Procfile` for Heroku/Render deployment
- Frontend: set `VITE_API_URL` env variable for production API base URL

### 2. Testing
- Convert `test_api.py` to proper `pytest` with assertions
- Add tests for new endpoints: analytics, profile, change-password
- Add auth failure tests (wrong token, missing token, wrong password)
- Frontend: basic smoke tests with Vitest + React Testing Library

### 3. Documentation
- Write `README.md` with setup instructions, env vars, and run commands
- Add API documentation (endpoint list, request/response shapes)
- Update inline code comments for exam explanation

### 4. Optional Enhancements
- Email/push notifications via a scheduler (e.g. APScheduler + Flask-Mail)
- Admin endpoints for user monitoring and cleanup
- Export tasks to CSV/PDF
- Better NLP with `spaCy` entity recognition instead of keyword matching

---

## 🧭 Development Workflow

1. **Setup backend**

   ```powershell
   cd backend
   python -m venv alkaenv
   .\alkaenv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python app.py
   ```

2. **Setup frontend**

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

3. **Run backend tests**

   ```powershell
   pytest tests/ -q
   ```
