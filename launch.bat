@echo off
setlocal enabledelayedexpansion
title AI Smart Grocery Assistant
cd /d "%~dp0"

echo.
echo   ==============================================================
echo      AI SMART GROCERY ASSISTANT
echo      Starting up, your browser will open in a moment...
echo   ==============================================================
echo.

REM ---------------------------------------------------------------
REM  Find a working Python interpreter
REM ---------------------------------------------------------------
set "PY_CMD="

where py >nul 2>&1
if %errorlevel%==0 (
    py -3 --version >nul 2>&1
    if !errorlevel!==0 set "PY_CMD=py -3"
)

if not defined PY_CMD (
    where python >nul 2>&1
    if !errorlevel!==0 (
        python --version >nul 2>&1
        if !errorlevel!==0 set "PY_CMD=python"
    )
)

if not defined PY_CMD (
    where python3 >nul 2>&1
    if !errorlevel!==0 set "PY_CMD=python3"
)

REM ---------------------------------------------------------------
REM  Preferred path: run the local backend (keeps the API key server side)
REM ---------------------------------------------------------------
if defined PY_CMD (
    echo   Using Python: !PY_CMD!
    echo.
    !PY_CMD! server.py
    echo.
    echo   The server has stopped.
    pause
    exit /b 0
)

REM ---------------------------------------------------------------
REM  Fallback: no Python found, open the app straight from disk
REM ---------------------------------------------------------------
echo   Python was not found on this computer.
echo.
echo   Opening the app directly in your browser instead.
echo   Everything still works - the app will call OpenRouter from the
echo   browser using the key in web\js\config.js.
echo.
echo   For the more secure setup ^(API key kept out of the browser^),
echo   install Python 3 from https://www.python.org/downloads/
echo   and tick "Add python.exe to PATH" during installation.
echo.

start "" "%~dp0web\index.html"

echo   Launched. You can close this window.
timeout /t 8 >nul
exit /b 0
