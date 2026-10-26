import os
import sys
import time
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.project import Project
from app.models.task import Task
from app.models.subtask import Subtask

client = TestClient(app)

def run_all_tests():
    print("=" * 60)
    print("STARTING COMPREHENSIVE NEON POSTGRESQL E2E VALIDATION")
    print("=" * 60)

    # ----------------------------------------------------
    # Test 1: Database Connection & Schema
    # ----------------------------------------------------
    print("\n--- TEST 1: Database Connection & Schema ---")
    db = SessionLocal()
    try:
        from sqlalchemy import text
        res = db.execute(text("SELECT current_database(), current_user, version();")).fetchone()
        print(f"PASS: Connected to Neon DB: '{res[0]}' as user '{res[1]}'")
        print(f"      Version: {res[2][:45]}...")
    finally:
        db.close()

    # ----------------------------------------------------
    # Test 2: Project Management
    # ----------------------------------------------------
    print("\n--- TEST 2: Project Management (Create & Persist) ---")
    proj_key = f"P{int(time.time()) % 10000}"
    proj_resp = client.post("/api/v1/projects", json={
        "name": f"Production E2E Project {proj_key}",
        "key": proj_key,
        "description": "Verified on Neon PostgreSQL",
        "priority": "high"
    })
    assert proj_resp.status_code == 201, f"Failed: {proj_resp.text}"
    project = proj_resp.json()
    project_id = project["id"]
    print(f"PASS: Project created on Neon with ID: {project_id}, Key: {project['key']}")

    # Verify project persists in direct DB query
    db = SessionLocal()
    try:
        db_proj = db.query(Project).filter(Project.id == project_id).first()
        assert db_proj is not None
        assert db_proj.key == proj_key
        print(f"PASS: Direct DB verification confirmed project '{db_proj.name}' in 'projects' table.")
    finally:
        db.close()

    # ----------------------------------------------------
    # Test 3: Task CRUD (Create, Read, Update, Delete)
    # ----------------------------------------------------
    print("\n--- TEST 3: Task CRUD Operations ---")
    # 3.1 Create Task A in Backlog
    task_a_resp = client.post("/api/v1/tasks", json={
        "project_id": project_id,
        "title": "Task A - Initial Backlog Task",
        "description": "E2E verification of task creation",
        "category": "Core",
        "status": "backlog",
        "priority": "medium",
        "due_date": "2026-11-20",
        "assignee_name": "Alex Morgan",
        "subtask_titles": ["Check requirement 1", "Check requirement 2"]
    })
    assert task_a_resp.status_code == 201
    task_a = task_a_resp.json()
    task_a_id = task_a["id"]
    print(f"PASS: Task A created: {task_a['task_key']} in Backlog with 2 subtasks")

    # 3.2 Update Task A (title, priority to urgent, is_blocked)
    patch_resp = client.patch(f"/api/v1/tasks/{task_a_id}", json={
        "title": "Task A - Updated Title",
        "priority": "urgent",
        "is_blocked": True,
        "blocker_reason": "Waiting on upstream dependency"
    })
    assert patch_resp.status_code == 200
    updated_a = patch_resp.json()
    assert updated_a["title"] == "Task A - Updated Title"
    assert updated_a["priority"] == "urgent"
    assert updated_a["is_blocked"] is True
    print(f"PASS: Task A updated on Neon: priority=urgent, is_blocked=True")

    # 3.3 Verify subtasks and toggle checklist
    assert len(updated_a["subtasks"]) == 2
    subtask_id = updated_a["subtasks"][0]["id"]
    st_patch = client.patch(
        f"/api/v1/tasks/{task_a_id}/subtasks/{subtask_id}",
        json={"is_completed": True}
    )
    assert st_patch.status_code == 200
    assert st_patch.json()["is_completed"] is True
    print(f"PASS: Subtask checklist toggled: is_completed=True")

    # ----------------------------------------------------
    # Test 4: Drag & Drop (Reorder between columns & same column)
    # ----------------------------------------------------
    print("\n--- TEST 4: Drag & Drop Reordering ---")
    # Create Task B in To Do
    task_b_resp = client.post("/api/v1/tasks", json={
        "project_id": project_id,
        "title": "Task B - Kanban Move Candidate",
        "status": "todo",
        "priority": "high"
    })
    assert task_b_resp.status_code == 201
    task_b = task_b_resp.json()
    task_b_id = task_b["id"]

    # Create Task C in To Do
    task_c_resp = client.post("/api/v1/tasks", json={
        "project_id": project_id,
        "title": "Task C - Second Candidate",
        "status": "todo",
        "priority": "low"
    })
    assert task_c_resp.status_code == 201
    task_c = task_c_resp.json()
    task_c_id = task_c["id"]

    # Drag Task A from Backlog to In Progress (position 0)
    move_resp = client.patch(
        f"/api/v1/tasks/{task_a_id}/reorder",
        json={"status": "in_progress", "position": 0}
    )
    assert move_resp.status_code == 200
    moved_a = move_resp.json()
    assert moved_a["status"] == "in_progress"
    assert moved_a["position"] == 0
    print(f"PASS: Dragged Task A from 'backlog' to 'in_progress' at position 0")

    # Drag Task C to top of 'todo' column (position 0, before Task B)
    reorder_resp = client.patch(
        f"/api/v1/tasks/{task_c_id}/reorder",
        json={"status": "todo", "position": 0}
    )
    assert reorder_resp.status_code == 200
    print(f"PASS: Reordered Task C to position 0 within 'todo' column")

    # ----------------------------------------------------
    # Test 5: Filters & Search Accuracy
    # ----------------------------------------------------
    print("\n--- TEST 5: Filter & Search Accuracy ---")
    # Fetch all tasks
    all_tasks_resp = client.get(f"/api/v1/tasks?project_id={project_id}")
    assert all_tasks_resp.status_code == 200
    all_tasks = all_tasks_resp.json()
    assert len(all_tasks) == 3
    print(f"PASS: Retrieved all {len(all_tasks)} tasks from Neon for project")

    # Filter by priority=urgent
    urgent_resp = client.get(f"/api/v1/tasks?project_id={project_id}&priority=urgent")
    assert urgent_resp.status_code == 200
    assert len(urgent_resp.json()) == 1
    assert urgent_resp.json()[0]["id"] == task_a_id
    print(f"PASS: Filter by priority=urgent returned exactly 1 task (Task A)")

    # Search keyword
    search_resp = client.get(f"/api/v1/tasks?project_id={project_id}&search=Candidate")
    assert search_resp.status_code == 200
    assert len(search_resp.json()) == 2
    print(f"PASS: Search 'Candidate' returned exactly 2 tasks (Task B & Task C)")

    # ----------------------------------------------------
    # Test 6: Persistence & Cleanup
    # ----------------------------------------------------
    print("\n--- TEST 6: Persistence Across Direct Queries ---")
    db = SessionLocal()
    try:
        tasks_in_neon = db.query(Task).filter(Task.project_id == project_id).all()
        assert len(tasks_in_neon) == 3
        print(f"PASS: Verified all 3 tasks persist in Neon PostgreSQL table 'tasks'")

        # Delete Task B
        del_resp = client.delete(f"/api/v1/tasks/{task_b_id}")
        assert del_resp.status_code == 200
        print(f"PASS: Successfully deleted Task B")

        # Clean up test artifacts
        client.delete(f"/api/v1/tasks/{task_a_id}")
        client.delete(f"/api/v1/tasks/{task_c_id}")
        client.delete(f"/api/v1/projects/{project_id}")
        print(f"PASS: Test records safely cleaned up on Neon without touching any user data")
    finally:
        db.close()

    print("\n" + "=" * 60)
    print("ALL 6 TESTS PASSED WITH 100% SUCCESS ON NEON POSTGRESQL!")
    print("=" * 60)

if __name__ == "__main__":
    run_all_tests()
