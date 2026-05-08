@echo off
setlocal EnableExtensions

rem Evida launcher. Prefer the curated Evida Release copy that is refreshed with each build.

set "ROOT=%~dp0"
set "SIMPLE_EXE=%ROOT%Evida Release\Evida.exe"
set "RELEASE_EXE=%ROOT%evida-core\desktop-tauri\src-tauri\target\release\evida-desktop.exe"
set "INSTALLED_EXE=%LOCALAPPDATA%\Evida\evida-desktop.exe"

if exist "%SIMPLE_EXE%" (
    echo Starting Evida from Evida Release:
    echo   %SIMPLE_EXE%
    start "" "%SIMPLE_EXE%"
    exit /b 0
)

if exist "%RELEASE_EXE%" (
    echo Starting Evida from repo release build:
    echo   %RELEASE_EXE%
    start "" "%RELEASE_EXE%"
    exit /b 0
)

if exist "%INSTALLED_EXE%" (
    echo Starting Evida from installed app:
    echo   %INSTALLED_EXE%
    start "" "%INSTALLED_EXE%"
    exit /b 0
)

echo Evida was not found.
echo.
echo Expected one of these files:
echo   %SIMPLE_EXE%
echo   %RELEASE_EXE%
echo   %INSTALLED_EXE%
echo.
echo Build the app with:
echo   cd /d "%ROOT%evida-core\desktop-tauri"
echo   npm.cmd run tauri:build
echo.
pause
