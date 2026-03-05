import pytest
import json
from app import app, db, User, Task, Note
from flask_jwt_extended import create_access_token

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['JWT_SECRET_KEY'] = 'test-secret-key'

    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.drop_all()

@pytest.fixture
def user(client):
    user = User(username='testuser', password='hashedpass')
    db.session.add(user)
    db.session.commit()
    return user

@pytest.fixture
def token(user):
    return create_access_token(identity=str(user.id))

def test_health(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.get_json() == {'status': 'ok'}

def test_register(client):
    data = {'username': 'newuser', 'password': 'pass123'}
    response = client.post('/api/register', json=data)
    assert response.status_code == 200
    assert 'message' in response.get_json()

    # Test duplicate
    response = client.post('/api/register', json=data)
    assert response.status_code == 400

def test_login(client):
    # Register first
    client.post('/api/register', json={'username': 'loginuser', 'password': 'pass123'})

    # Login
    response = client.post('/api/login', json={'username': 'loginuser', 'password': 'pass123'})
    assert response.status_code == 200
    assert 'access_token' in response.get_json()

    # Invalid login
    response = client.post('/api/login', json={'username': 'loginuser', 'password': 'wrong'})
    assert response.status_code == 401

def test_create_task(client, token):
    headers = {'Authorization': f'Bearer {token}'}
    data = {'title': 'Test Task', 'description': 'Desc', 'priority': 'High', 'due_date': '2025-12-01'}
    response = client.post('/api/tasks', headers=headers, json=data)
    assert response.status_code == 201
    assert 'task_id' in response.get_json()

def test_get_tasks(client, token):
    headers = {'Authorization': f'Bearer {token}'}
    # Create a task
    client.post('/api/tasks', headers=headers, json={'title': 'Task 1'})

    response = client.get('/api/tasks', headers=headers)
    assert response.status_code == 200
    tasks = response.get_json()
    assert len(tasks) == 1
    assert tasks[0]['title'] == 'Task 1'

def test_update_task(client, token):
    headers = {'Authorization': f'Bearer {token}'}
    # Create
    resp = client.post('/api/tasks', headers=headers, json={'title': 'Old Title'})
    task_id = resp.get_json()['task_id']

    # Update
    data = {'title': 'New Title', 'completed': True}
    response = client.put(f'/api/tasks/{task_id}', headers=headers, json=data)
    assert response.status_code == 200

    # Verify
    resp = client.get('/api/tasks', headers=headers)
    tasks = resp.get_json()
    assert tasks[0]['title'] == 'New Title'
    assert tasks[0]['completed'] == True

def test_delete_task(client, token):
    headers = {'Authorization': f'Bearer {token}'}
    # Create
    resp = client.post('/api/tasks', headers=headers, json={'title': 'To Delete'})
    task_id = resp.get_json()['task_id']

    # Delete
    response = client.delete(f'/api/tasks/{task_id}', headers=headers)
    assert response.status_code == 200

    # Verify
    resp = client.get('/api/tasks', headers=headers)
    tasks = resp.get_json()
    assert len(tasks) == 0

def test_task_filters(client, token):
    headers = {'Authorization': f'Bearer {token}'}
    # Create tasks
    client.post('/api/tasks', headers=headers, json={'title': 'High Task', 'priority': 'High'})
    client.post('/api/tasks', headers=headers, json={'title': 'Low Task', 'priority': 'Low'})

    # Filter by priority
    response = client.get('/api/tasks?priority=High', headers=headers)
    tasks = response.get_json()
    assert len(tasks) == 1
    assert tasks[0]['title'] == 'High Task'

def test_task_stats(client, token):
    headers = {'Authorization': f'Bearer {token}'}
    # Create tasks
    client.post('/api/tasks', headers=headers, json={'title': 'Task 1', 'completed': True})
    client.post('/api/tasks', headers=headers, json={'title': 'Task 2'})

    response = client.get('/api/tasks/stats', headers=headers)
    stats = response.get_json()
    assert stats['total_tasks'] == 2
    assert stats['completed_tasks'] == 1
    assert stats['pending_tasks'] == 1

def test_notes_crud(client, token):
    headers = {'Authorization': f'Bearer {token}'}
    # Create
    data = {'title': 'Test Note', 'content': 'Content'}
    resp = client.post('/api/notes', headers=headers, json=data)
    assert resp.status_code == 201
    note_id = resp.get_json()['note_id']

    # Get
    resp = client.get('/api/notes', headers=headers)
    notes = resp.get_json()
    assert len(notes) == 1

    # Update
    client.put(f'/api/notes/{note_id}', headers=headers, json={'content': 'Updated'})

    # Delete
    client.delete(f'/api/notes/{note_id}', headers=headers)
    resp = client.get('/api/notes', headers=headers)
    assert len(resp.get_json()) == 0

def test_unauthorized_access(client):
    # Try to get tasks without token
    response = client.get('/api/tasks')
    assert response.status_code == 401

    # Register two users
    client.post('/api/register', json={'username': 'user1', 'password': 'pass'})
    client.post('/api/register', json={'username': 'user2', 'password': 'pass'})

    # Login user1
    resp = client.post('/api/login', json={'username': 'user1', 'password': 'pass'})
    token1 = resp.get_json()['access_token']

    # Login user2
    resp = client.post('/api/login', json={'username': 'user2', 'password': 'pass'})
    token2 = resp.get_json()['access_token']

    # User1 creates task
    headers1 = {'Authorization': f'Bearer {token1}'}
    resp = client.post('/api/tasks', headers=headers1, json={'title': 'User1 Task'})
    task_id = resp.get_json()['task_id']

    # User2 tries to delete user1's task
    headers2 = {'Authorization': f'Bearer {token2}'}
    response = client.delete(f'/api/tasks/{task_id}', headers=headers2)
    assert response.status_code == 404  # Not found because not their task
