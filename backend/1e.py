from app import create_app, db
from models import Task, User

app = create_app()
with app.app_context():
    # Get a user by email
    user = User.query.filter_by(email="kamleshmali9029@gmail.com").first()
    
    # Delete all tasks for that user
    
    
    # Or check total tasks
    total = Task.query.filter_by(user_id=user.id).count()
    print(f"Total tasks: {total}")