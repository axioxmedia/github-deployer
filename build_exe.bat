@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === GitHub Deploy Desk : build EXE ===
echo.

set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY where python3 >nul 2>&1 && set "PY=python3"
if not defined PY if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PY=%LocalAppData%\Programs\Python\Python312\python.exe"
if not defined PY if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "PY=%LocalAppData%\Programs\Python\Python311\python.exe"
if not defined PY if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
if not defined PY if exist "C:\Python311\python.exe" set "PY=C:\Python311\python.exe"

if not defined PY (
  echo [ERROR] Python was not found.
  echo Install Python 3.11+ from https://www.python.org/downloads/windows/
  echo and check "Add python.exe to PATH".
  pause
  exit /b 1
)

echo Using: %PY%
%PY% -c "import sys; print(sys.version)"
if errorlevel 1 (
  echo [ERROR] Python exists but cannot start.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating .venv ...
  %PY% -m venv .venv
  if errorlevel 1 (
    echo [ERROR] Failed to create venv.
    pause
    exit /b 1
  )
)

echo Closing previous EXE if it is running ...
taskkill /F /IM GitHubDeployDesk.exe >nul 2>&1
timeout /t 2 /nobreak >nul

if exist "dist\GitHubDeployDesk.exe" (
  del /f /q "dist\GitHubDeployDesk.exe" >nul 2>&1
)
if exist "dist\GitHubDeployDesk.exe" (
  echo [ERROR] Cannot replace dist\GitHubDeployDesk.exe
  echo Close the app and any Explorer preview, then run this bat again.
  pause
  exit /b 1
)

set "VPY=.venv\Scripts\python.exe"
echo Installing packages ...
"%VPY%" -m pip install -U pip
if errorlevel 1 (
  echo [ERROR] pip upgrade failed.
  pause
  exit /b 1
)
"%VPY%" -m pip install -r requirements.txt -r requirements-build.txt
if errorlevel 1 (
  echo [ERROR] pip install failed.
  pause
  exit /b 1
)

echo Building EXE ...
"%VPY%" -m PyInstaller --noconfirm --clean GitHubDeployDesk.spec
if errorlevel 1 (
  echo [ERROR] PyInstaller failed.
  pause
  exit /b 1
)

echo.
echo OK
echo EXE: "%cd%\dist\GitHubDeployDesk.exe"
echo.
if exist "dist\GitHubDeployDesk.exe" explorer dist
pause
