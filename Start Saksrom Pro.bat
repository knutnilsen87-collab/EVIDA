@echo off
setlocal

set "ROOT=%~dp0"
set "RELEASE_EXE=%ROOT%saksrom-pro\desktop-tauri\src-tauri\target\release\saksrom-pro-desktop.exe"
set "INSTALLED_EXE=%LOCALAPPDATA%\Saksrom Pro\saksrom-pro-desktop.exe"

if exist "%RELEASE_EXE%" (
    start "" "%RELEASE_EXE%"
    exit /b 0
)

if exist "%INSTALLED_EXE%" (
    start "" "%INSTALLED_EXE%"
    exit /b 0
)

echo Saksrom Pro ble ikke funnet.
echo.
echo Forventet en av disse filene:
echo   %RELEASE_EXE%
echo   %INSTALLED_EXE%
echo.
echo Bygg appen med:
echo   cd /d "%ROOT%saksrom-pro\desktop-tauri"
echo   npm.cmd run tauri:build
echo.
pause
