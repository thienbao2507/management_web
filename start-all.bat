@echo off
echo =======================================================
echo Starting Management Web (Backend + Frontend)
echo =======================================================
start "FastAPI Backend (Port 8000)" cmd /k "call conda activate env_310 && cd backend && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
timeout /t 2 >nul
start "React Frontend (Port 6006)" cmd /k "npm --prefix frontend run dev"
echo Both services are running!
echo Access the app at: http://localhost:6006
