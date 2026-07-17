# Digital Twin – AI Task Analytics Platform

An intelligent task management backend that turns your inbox into actionable tasks and forecasts your workload — built with Flask, MySQL, and Groq's LLM API.

## Features

### 📧 Gmail-to-Task Pipeline
- Connects to Gmail via Google OAuth2
- Scans whitelisted senders for new emails (last 30 days)
- Uses Groq's LLaMA 3.1 model to classify each email and extract structured task data (title, priority, due date, category)
- Automatically skips non-actionable emails and deduplicates against existing tasks
- Typical batch of a few emails processes in under 5 seconds

### 📊 Task Volume Forecasting
- `/tasks/predict` endpoint estimates next week's task volume
- Fits a scikit-learn `LinearRegression` model on historical weekly task counts
- Requires 3+ weeks of usage history for a high-confidence prediction; falls back to a simple average for newer accounts

### 💬 Natural-Language Task Queries
- `/query` endpoint accepts free-text questions (e.g., "what's overdue," "show high priority tasks")
- Rule-based intent matching maps questions to structured filters (due date, priority, completion status)

### 📈 Analytics Dashboard
- Completion rate, priority distribution, and daily streak tracking
- Visualized on the frontend using Recharts

### 🔐 Auth & Data
- JWT-based authentication (Flask-JWT-Extended)
- MySQL relational schema (Flask-SQLAlchemy + PyMySQL) for tasks, users, and Google integration state

## Tech Stack
**Backend:** Flask, scikit-learn, Groq API, MySQL, Google Gmail/OAuth2 API
**Frontend:** React, Recharts

## Setup

### Backend
\`\`\`bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
\`\`\`

Create a \`.env\` file in \`backend/\` with:
\`\`\`
DATABASE_URL=mysql+pymysql://user:password@localhost/alkapro
JWT_SECRET_KEY=your_secret_key
GROQ_API_KEY=your_groq_key
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
FRONTEND_URL=http://localhost:5173
\`\`\`

\`\`\`bash
python app.py
\`\`\`

### Frontend
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

## Known Limitations
- Forecasting is a simple trend-based linear model, not validated against a held-out test set
- Gmail sync is rate-limited to 5 requests/hour per user