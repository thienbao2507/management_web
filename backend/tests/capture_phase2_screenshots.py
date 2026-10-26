import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\ThienBao\.gemini\antigravity-cli\brain\43b1b497-206c-42e3-9279-d2f3d2c0daec"
os.makedirs(artifact_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()

    # 1. Desktop Viewport
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:6006", wait_until="networkidle")
    time.sleep(2)

    # Check if empty project state is shown, click "Create First Project"
    create_first_proj_btn = page.locator("button:has-text('Create First Project')")
    if create_first_proj_btn.is_visible():
        create_first_proj_btn.click()
        time.sleep(0.5)
        page.fill("input[placeholder*='Mobile App Redesign']", "Apex Command Center")
        page.fill("input[placeholder*='Auto-generated']", "CMD")
        page.fill("textarea", "Real-world project command center connected to Neon PostgreSQL")
        page.click("button:has-text('Create Project')")
        time.sleep(2)

    # Add sample tasks if Kanban is empty
    tasks_count = page.locator(".group.cursor-grab").count()
    if tasks_count == 0:
        # Task 1 in Backlog
        page.click("button[title*='Quick add task to this column'] >> nth=0")
        time.sleep(0.5)
        page.fill("input[placeholder*='Implement Neon']", "Benchmark cold-load performance on 3G")
        page.fill("textarea[placeholder*='acceptance criteria']", "Audit asset bundles to guarantee FID < 100ms")
        page.click("button:has-text('Create Task')")
        time.sleep(1.5)

        # Task 2 in To Do
        page.click("button[title*='Quick add task to this column'] >> nth=1")
        time.sleep(0.5)
        page.fill("input[placeholder*='Implement Neon']", "Implement WebAuthn biometrics fallback")
        page.select_option("select:has(option[value='urgent'])", "high")
        page.click("button:has-text('Create Task')")
        time.sleep(1.5)

        # Task 3 in In Progress
        page.click("button[title*='Quick add task to this column'] >> nth=2")
        time.sleep(0.5)
        page.fill("input[placeholder*='Implement Neon']", "Integrate real-time collaborative cursors")
        page.select_option("select:has(option[value='urgent'])", "urgent")
        page.click("button:has-text('Create Task')")
        time.sleep(2)

    # 1. Desktop Light Mode Screenshot
    page.evaluate("() => localStorage.setItem('management_web_theme', 'light')")
    page.reload(wait_until="networkidle")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(artifact_dir, "phase2_desktop_light.png"))
    print("Captured phase2_desktop_light.png")

    # 2. Desktop Dark Mode Screenshot
    page.evaluate("() => localStorage.setItem('management_web_theme', 'dark')")
    page.reload(wait_until="networkidle")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(artifact_dir, "phase2_desktop_dark.png"))
    print("Captured phase2_desktop_dark.png")

    # 3. Open Real Task Detail Drawer
    first_task = page.locator(".group.cursor-grab").first
    if first_task.is_visible():
        first_task.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(artifact_dir, "phase2_task_detail.png"))
        print("Captured phase2_task_detail.png")
        page.keyboard.press("Escape")
        time.sleep(0.5)

    # 4. Mobile Viewport
    mobile_page = browser.new_page(viewport={"width": 390, "height": 844})
    mobile_page.goto("http://127.0.0.1:6006", wait_until="networkidle")
    mobile_page.evaluate("() => localStorage.setItem('management_web_theme', 'dark')")
    mobile_page.reload(wait_until="networkidle")
    time.sleep(1.5)
    mobile_page.screenshot(path=os.path.join(artifact_dir, "phase2_mobile_dark.png"))
    print("Captured phase2_mobile_dark.png")

    browser.close()
    print("All Phase 2 screenshots successfully captured!")
