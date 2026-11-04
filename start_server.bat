@echo off
title NetCare ISP Support Server
echo ========================================================
echo Starting NetCare ISP Customer Support System...
echo ========================================================
cd /d "%~dp0"
call .\venv\Scripts\activate
echo Server starting at http://localhost:8000 (and http://127.0.0.1:8000)
echo Press Ctrl+C to stop the server.
echo ========================================================
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
