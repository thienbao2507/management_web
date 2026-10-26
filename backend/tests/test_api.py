import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_project_and_task_lifecycle():
    # 1. Create a test project
    proj_payload = {
        "name": "E2E Automated Test Project",
        "key": "E2E",
        "description": "Integration testing on Neon PostgreSQL",
        "priority": "high"
    }
    create_proj_resp = client.post("/api/v1/projects", json=proj_payload)
    # If key E2E exists, handle duplicate by adding random
    if create_proj_resp.status_code == 400:
        import time
        proj_payload["key"] = f"E{int(time.time()) % 1000}"
        create_proj_resp = client.post("/api/v1/projects", json=proj_payload)

    assert create_proj_resp.status_code == 201
    project = create_proj_resp.json()
    project_id = project["id"]
    assert project["name"] == proj_payload["name"]

    # 2. Create Task A in Backlog
    task_a_payload = {
        "project_id": project_id,
        "title": "Task A - Initial Backlog Item",
        "description": "Testing CRUD flow",
        "category": "Testing",
        "priority": "medium",
        "status": "backlog",
        "subtask_titles": ["Subtask 1", "Subtask 2"]
    }
    task_a_resp = client.post("/api/v1/tasks", json=task_a_payload)
    assert task_a_resp.status_code == 201
    task_a = task_a_resp.json()
    task_a_id = task_a["id"]
    assert task_a["title"] == task_a_payload["title"]
    assert task_a["status"] == "backlog"
    assert len(task_a["subtasks"]) == 2

    # 3. Create Task B in To Do
    task_b_payload = {
        "project_id": project_id,
        "title": "Task B - Second Item",
        "priority": "urgent",
        "status": "todo"
    }
    task_b_resp = client.post("/api/v1/tasks", json=task_b_payload)
    assert task_b_resp.status_code == 201
    task_b = task_b_resp.json()
    task_b_id = task_b["id"]

    # 4. Move Task A from Backlog to In Progress (reorder)
    reorder_resp = client.patch(
        f"/api/v1/tasks/{task_a_id}/reorder",
        json={"status": "in_progress", "position": 0}
    )
    assert reorder_resp.status_code == 200
    updated_task_a = reorder_resp.json()
    assert updated_task_a["status"] == "in_progress"
    assert updated_task_a["position"] == 0

    # 5. Update Task A details (mark blocked)
    update_resp = client.patch(
        f"/api/v1/tasks/{task_a_id}",
        json={"is_blocked": True, "blocker_reason": "Waiting for CI approval"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["is_blocked"] is True

    # 6. Delete Task B
    del_resp = client.delete(f"/api/v1/tasks/{task_b_id}")
    assert del_resp.status_code == 200

    # Verify Task B is gone
    get_del = client.get(f"/api/v1/tasks/{task_b_id}")
    assert get_del.status_code == 404

    # 7. Clean up: Delete / Archive project and Task A
    client.delete(f"/api/v1/tasks/{task_a_id}")
    client.delete(f"/api/v1/projects/{project_id}")
