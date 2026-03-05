# 🤖 Your Digital Twin – AI-Powered Personal Assistant (Backend)

This repository contains the **Flask-based REST API** for a digital assistant where users can register,
login with JWT authentication, and manage their own tasks (CRUD operations).

### 🧩 Technologies
- Python 3.10+
- Flask
- Flask-SQLAlchemy (SQLite database)
- Flask-JWT-Extended for authentication
- Werkzeug for password hashing

### 📁 Relevant Structure
```
backend_clean/             # main API server
  ├─ app.py                # Flask app and routes
  ├─ test_api.py           # functional tests
  ├─ digital_twin.db       # SQLite file (created automatically)
  └─ requirements.txt
frontend/                  # React user interface
  └─ ts-app/               # downloaded React + TypeScript (Vite) UI
```
### 🚀 Quick Start
```powershell
cd alkapro\backend_clean
python -m venv venv            # create virtual env (optional)
venv\Scripts\activate
pip install -r requirements.txt
# set JWT secret if you like:
# set JWT_SECRET_KEY=your_secret
python app.py
```
API runs on `http://127.0.0.1:5000`.

### 📝 API Endpoints
- `POST /api/register` – JSON `{username,password}`
- `POST /api/login` – JSON `{username,password}` returns `access_token`
- All task routes require `Authorization: Bearer <token>` header

Task endpoints:
- `GET /api/tasks` – list tasks (query params: `priority`, `completed`, `sort_by` e.g. `due_date`/`-due_date`)
- `POST /api/tasks` – create {title,description?,priority?,due_date?}
- `PUT/PATCH /api/tasks/<id>` – update any field
- `DELETE /api/tasks/<id>` – remove task
- `GET /api/tasks/overdue` – overdue tasks
- `GET /api/tasks/stats` – simple counts
- `GET /api/tasks/recommend` – returns a single task suggestion

### 🧪 Running the Tests
Make sure the server is running, then:
```powershell
python test_api.py
```

### 📌 Notes
- Passwords are hashed with Werkzeug.
- JWT secret can be set via `JWT_SECRET_KEY` environment variable for deployment.
- Tasks are always filtered by `user_id` extracted from token – users cannot access each other’s data.
- There is no root (`/`) route by design; this is an API‑only backend.

---
Feel free to expand with a frontend or deploy to a cloud service.

