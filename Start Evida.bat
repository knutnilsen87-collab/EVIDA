@echo off
setlocal

set "ROOT=%~dp0"
set "SIMPLE_EXE=%ROOT%Evida Release\Evida.exe"
set "RELEASE_EXE=%ROOT%evida-core\desktop-tauri\src-tauri\target\release\evida-desktop.exe"
set "INSTALLED_EXE=%LOCALAPPDATA%\Evida\evida-desktop.exe"

if exist "%RELEASE_EXE%" (
    start "" "%RELEASE_EXE%"
    exit /b 0
)

if exist "%SIMPLE_EXE%" (
    start "" "%SIMPLE_EXE%"
    exit /b 0
)

if exist "%INSTALLED_EXE%" (
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
