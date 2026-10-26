@echo off
echo ===================================================
echo Starting Management Web - FastAPI Backend (Port 8000)
echo ===================================================
call conda activate env_310
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
