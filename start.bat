@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if exist "dist\GitHubDeployDesk.exe" (
  start "" "%cd%\dist\GitHubDeployDesk.exe"
  exit /b 0
)

set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY where python3 >nul 2>&1 && set "PY=python3"

if not defined PY (
  echo [ERROR] Python was not found. Run build_exe.bat after installing Python 3.11+.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  %PY% -m venv .venv
)

".venv\Scripts\python.exe" -m pip install -r requirements.txt
".venv\Scripts\python.exe" app.py
