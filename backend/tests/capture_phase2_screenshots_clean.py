import os
import sys
import time
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from playwright.sync_api import sync_playwright

client = TestClient(app)
artifact_dir = r"C:\Users\ThienBao\.gemini\antigravity-cli\brain\43b1b497-206c-42e3-9279-d2f3d2c0daec"
os.makedirs(artifact_dir, exist_ok=True)

print("Preparing real Neon PostgreSQL test dataset...")
# Ensure project exists
proj_resp = client.get("/api/v1/projects")
projects = proj_resp.json()
target_proj = None
for p in projects:
    if p["key"] == "CMD":
        target_proj = p
        break

if not target_proj:
    create_p = client.post("/api/v1/projects", json={
        "name": "Apex Command Center",
        "key": "CMD",
        "description": "Project Management Workspace connected to Neon PostgreSQL",
        "priority": "urgent"
    })
    target_proj = create_p.json()

project_id = target_proj["id"]
print(f"Using Project: {target_proj['name']} ({target_proj['key']}) on Neon")

# Ensure tasks exist
tasks_resp = client.get(f"/api/v1/tasks?project_id={project_id}")
current_tasks = tasks_resp.json()
if len(current_tasks) < 4:
    tasks_to_create = [
        {
            "project_id": project_id,
            "title": "Benchmark cold-load performance on 3G",
            "description": "Run Lighthouse and WebPageTest audits across major screen viewports to ensure FID < 100ms and LCP < 1.8s.",
            "category": "Performance",
            "status": "backlog",
            "priority": "low",
            "due_date": "2026-11-12",
            "assignee_name": "David Miller",
            "subtask_titles": [
                "Setup headless Chrome audit script",
                "Collect initial memory profiles",
                "Document asset chunking bottlenecks"
            ]
        },
        {
            "project_id": project_id,
            "title": "Implement WebAuthn biometrics login fallback",
            "description": "Provide passkey login support with graceful fallback to TOTP authentication on legacy devices.",
            "category": "Security",
            "status": "todo",
            "priority": "medium",
            "due_date": "2026-11-18",
            "assignee_name": "Sarah Chen",
            "subtask_titles": [
                "Evaluate FIDO2 navigator credentials API",
                "Create fallback modal UI",
                "Integrate backend challenge verification"
            ]
        },
        {
            "project_id": project_id,
            "title": "Integrate real-time collaborative cursors and presence",
            "description": "Synchronize active board viewers and highlight task cards currently being edited by other team members.",
            "category": "Backend",
            "status": "in_progress",
            "priority": "urgent",
            "due_date": "2026-10-28",
            "assignee_name": "Alex Morgan",
            "subtask_titles": [
                "Heartbeat protocol specification",
                "State broadcast debounce",
                "Conflict resolution on rapid drag"
            ]
        },
        {
            "project_id": project_id,
            "title": "Refactor global cache layer with TanStack Query v5",
            "description": "Migrate legacy state listeners to query client hooks with optimistic mutation rollbacks.",
            "category": "Architecture",
            "status": "done",
            "priority": "high",
            "due_date": "2026-10-22",
            "assignee_name": "David Miller",
            "subtask_titles": [
                "Query key factory setup",
                "Mutation rollback on network drop",
                "Cache invalidation listeners"
            ]
        }
    ]

    for t_data in tasks_to_create:
        client.post("/api/v1/tasks", json=t_data)

    # Mark the in_progress task as blocked
    in_prog = client.get(f"/api/v1/tasks?project_id={project_id}&status=in_progress").json()
    if in_prog:
        client.patch(f"/api/v1/tasks/{in_prog[0]['id']}", json={
            "is_blocked": True,
            "blocker_reason": "Awaiting Core Auth WebSocket endpoint approval"
        })

print("Dataset ready on Neon PostgreSQL. Capturing Playwright screenshots...")

with sync_playwright() as p:
    browser = p.chromium.launch()

    # 1. Desktop Light Mode
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:6006", wait_until="networkidle")
    page.evaluate(f"() => {{ localStorage.setItem('management_web_theme', 'light'); localStorage.setItem('management_web_project_id', '{project_id}'); }}")
    page.reload(wait_until="networkidle")
    time.sleep(2)
    page.screenshot(path=os.path.join(artifact_dir, "phase2_desktop_light.png"))
    print("Captured phase2_desktop_light.png")

    # 2. Desktop Dark Mode
    page.evaluate("() => localStorage.setItem('management_web_theme', 'dark')")
    page.reload(wait_until="networkidle")
    time.sleep(2)
    page.screenshot(path=os.path.join(artifact_dir, "phase2_desktop_dark.png"))
    print("Captured phase2_desktop_dark.png")

    # 3. Open Real Task Detail Drawer
    task_card = page.locator(".group.cursor-grab").first
    if task_card.is_visible():
        task_card.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(artifact_dir, "phase2_task_detail.png"))
        print("Captured phase2_task_detail.png")
        page.keyboard.press("Escape")
        time.sleep(0.5)

    # 4. Mobile Viewport (Dark Mode)
    mobile_page = browser.new_page(viewport={"width": 390, "height": 844})
    mobile_page.goto("http://127.0.0.1:6006", wait_until="networkidle")
    mobile_page.evaluate(f"() => {{ localStorage.setItem('management_web_theme', 'dark'); localStorage.setItem('management_web_project_id', '{project_id}'); }}")
    mobile_page.reload(wait_until="networkidle")
    time.sleep(2)
    mobile_page.screenshot(path=os.path.join(artifact_dir, "phase2_mobile_dark.png"))
    print("Captured phase2_mobile_dark.png")

    browser.close()
    print("All Phase 2 screenshots successfully generated!")
