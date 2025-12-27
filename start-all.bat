@echo off
REM ============================================
REM Distributed Cloud - Unified Startup Script
REM ============================================
REM Ensures all components use the correct IPFS:
REM - Docker Cluster: port 5001 (backup storage)
REM - Local Kubo: port 5002 (provider storage)

echo.
echo ===== DISTRIBUTED CLOUD STARTUP =====
echo.

REM Set IPFS_PATH to user's default repository
set IPFS_PATH=%USERPROFILE%\.ipfs
echo IPFS repository: %IPFS_PATH%

REM Check if local IPFS daemon is already running on port 5002
netstat -ano | findstr ":5002" >NUL 2>&1
if %ERRORLEVEL%==0 (
    echo [INFO] Local IPFS daemon already running on port 5002
) else (
    echo [START] Starting local IPFS daemon ^(port 5002^)...
    start "IPFS Daemon (Local)" cmd /c "set IPFS_PATH=%USERPROFILE%\.ipfs && ipfs daemon"
    echo Waiting for IPFS to start...
    timeout /t 5 /nobreak >NUL
)

REM Start Backend
echo [START] Starting Backend...
start "Backend" cmd /c "cd /d %~dp0Backend && npm start"
timeout /t 3 /nobreak >NUL

REM Start Provider Agent (connects to local IPFS on 5002)
echo [START] Starting Provider Agent ^(uses port 5002^)...
start "Provider Agent" cmd /c "cd /d %~dp0ProviderAgent && npm start"
timeout /t 2 /nobreak >NUL

REM Start Frontend
echo [START] Starting Frontend...
start "Frontend" cmd /c "cd /d %~dp0Frontend\frontend && npm start"

echo.
echo ===== ALL COMPONENTS STARTED =====
echo.
echo PORT MAPPING:
echo   - Local IPFS API:    5002 ^(provider storage^)
echo   - Local IPFS Gateway: 8081
echo   - Docker Cluster:    5001 ^(backup storage^)
echo   - Backend:           3001
echo   - Provider Agent:    4000
echo   - Frontend:          3000
echo.
echo To verify provider storage works:
echo   1. Upload a file with a contract
echo   2. Run: ipfs pin ls ^| findstr [CID]
echo.
echo Press any key to exit this window...
pause >NUL
