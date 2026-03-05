from flask import Flask, render_template, request, redirect, url_for, flash, make_response
from src.database import insert_task, get_tasks, ensure_status_column

from datetime import datetime, date, timedelta
from collections import defaultdict
import json
import csv
import io
import os

app = Flask(__name__)
app.secret_key = "dev-secret-change-this"   # change for production

# Ensure DB column exists (safe to call on each start)
ensure_status_column()

# ---------- helpers ----------
def parse_date(date_str):
    """
    Try multiple formats and return a `date` object or None
    """
    if not date_str:
        return None
    s = str(date_str).strip()
    fmts = [
        "%Y-%m-%d",            # 2025-09-17
        "%m/%d/%Y",            # 09/17/2025
        "%Y-%m-%d %H:%M:%S",   # 2025-09-17 13:27:00
        "%Y-%m-%dT%H:%M",      # 2025-09-17T13:27
        "%d-%m-%Y",            # 17-09-2025
    ]
    for f in fmts:
        try:
            return datetime.strptime(s, f).date()
        except ValueError:
            continue
    try:
        # last resort: ISO
        return datetime.fromisoformat(s).date()
    except Exception:
        return None

def parse_time_to_timeobj(time_str):
    """
    Parse time strings like HH:MM or HH:MM:SS to a time object or None
    """
    if not time_str:
        return None
    s = str(time_str).strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    return None

# ---------- routes ----------
@app.route("/")
def index():
    # 1) Fetch all tasks for analytics
    all_tasks = get_tasks()  # each row is a dict: id, tasks_name, tasks_date, tasks_time, status, source

    # 2) KPI analytics (on ALL tasks)
    total = len(all_tasks)
    completed = sum(1 for t in all_tasks if (t.get("status") or "").lower() == "done")
    pending = total - completed

    today = date.today()
    due_today = 0
    week_counts = defaultdict(int)
    last7 = [today - timedelta(days=i) for i in range(6, -1, -1)]
    last7_set = set(last7)

    for t in all_tasks:
        d = parse_date(t.get("tasks_date") or t.get("due_date") or t.get("due_at"))
        if not d:
            continue
        if d == today:
            due_today += 1
        if d in last7_set:
            week_counts[d] += 1

    chart_labels = [d.strftime("%d %b") for d in last7]
    chart_values = [week_counts[d] for d in last7]

    # 3) UI filter (which tasks to DISPLAY)
    active_filter = request.args.get("filter", "all")  # all|today|upcoming|completed
    displayed = []

    for t in all_tasks:
        status = (t.get("status") or "pending").lower()
        d = parse_date(t.get("tasks_date") or t.get("due_date") or t.get("due_at"))

        if active_filter == "all":
            displayed.append(t)
        elif active_filter == "today":
            if d == today:
                displayed.append(t)
        elif active_filter == "upcoming":
            if d and d > today and status != "done":
                displayed.append(t)
        elif active_filter == "completed":
            if status == "done":
                displayed.append(t)
        else:
            displayed.append(t)  # fallback

    # 4) Add time-awareness: due_hint + row_class
    now = datetime.now()
    processed = []

    for t in displayed:
        status = (t.get("status") or "pending").lower()
        due_date = parse_date(t.get("tasks_date"))
        due_time = parse_time_to_timeobj(t.get("tasks_time"))

        row_class = ""
        due_hint = ""

        if due_date and due_time:
            due_dt = datetime.combine(due_date, due_time)
        elif due_date:
            # default to end of day if only date present
            due_dt = datetime.combine(due_date, datetime.max.time().replace(microsecond=0))
        else:
            due_dt = None

        if due_dt:
            delta = due_dt - now
            seconds = delta.total_seconds()
            hours = int(seconds // 3600)

            if seconds < 0 and status != "done":
                # overdue
                row_class = "list-group-item-danger"
                if abs(hours) < 24:
                    due_hint = f"Overdue by {abs(hours)} hour(s)"
                else:
                    days = abs(hours) // 24
                    due_hint = f"Overdue by {days} day(s)"
            elif 0 <= seconds <= 24 * 3600 and status != "done":
                # due within 24 hours
                row_class = "list-group-item-warning"
                if hours == 0:
                    due_hint = "Due very soon"
                else:
                    due_hint = f"Due in {hours} hour(s)"
            else:
                if status == "done":
                    due_hint = "Completed"
                elif seconds > 0:
                    days = max(1, hours // 24)
                    due_hint = f"Due in {days} day(s)"

        t["row_class"] = row_class
        t["due_hint"] = due_hint
        processed.append(t)

    return render_template(
        "index.html",
        tasks=processed,
        active_filter=active_filter,
        stats=dict(total=total, completed=completed, pending=pending, due_today=due_today),
        chart_labels=json.dumps(chart_labels),
        chart_values=json.dumps(chart_values),
    )

# Import demo tasks (POST route)
@app.route('/import_demo', methods=['POST'])
def import_demo():
    """
    Simple demo import that inserts a couple of demo tasks into the DB.
    Triggered from the frontend import button (we'll call it using POST).
    """
    sample_tasks = [
        {"name": "Demo Task 1", "due_date": "2025-12-15", "due_time": "10:00", "source": "demo"},
        {"name": "Demo Task 2", "due_date": "2025-12-16", "due_time": "11:00", "source": "demo"}
    ]

    count = 0
    for task in sample_tasks:
        try:
            insert_task(task["name"], task["due_date"], task["due_time"], source=task["source"])
            count += 1
        except Exception as e:
            # keep going on errors but log to console (or replace with logger)
            print("Error inserting demo task:", e)

    flash(f"Imported {count} demo tasks ✅")
    return redirect(url_for("index"))

# Gmail demo importer (GET is fine for demo)
@app.route("/import_gmail_demo")
def import_gmail_demo():
    """
    Demo: read gmail_demo.json from the project folder and insert tasks.
    If file missing, create a default one first.
    """
    demo_file = os.path.join(os.path.dirname(__file__), "gmail_demo.json")
