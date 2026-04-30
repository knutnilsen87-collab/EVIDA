@echo off
setlocal

set "ROOT=%~dp0saksrom-pro"
set "CARGO_TARGET_DIR=C:\Temp\saksrom-cargo-target-1880"
set "APP_EXE=%CARGO_TARGET_DIR%\release\saksrom-pro-desktop.exe"
set "PATH=%USERPROFILE%\.cargo\bin;C:\Program Files\Tesseract-OCR;%ROOT%\.tools\bin;%PATH%"

if not exist "%ROOT%\desktop-tauri" (
  echo Could not find Saksrom Pro project folder:
  echo %ROOT%
  pause
  exit /b 1
)

if exist "%APP_EXE%" (
  start "" "%APP_EXE%"
  exit /b 0
)

echo Saksrom Pro executable was not found.
echo Building the desktop app now. This can take a few minutes the first time.
echo.

cd /d "%ROOT%\desktop-tauri"
call npm.cmd run tauri:build
if errorlevel 1 (
  echo.
  echo Build failed. See the output above.
  pause
  exit /b 1
)

if exist "%APP_EXE%" (
  start "" "%APP_EXE%"
  exit /b 0
)

echo.
echo Build completed, but the app executable was not found here:
echo %APP_EXE%
pause
exit /b 1
