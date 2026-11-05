@echo off
setlocal
cd /d "%~dp0"
set "PYTHONUTF8=1"

rem Test a working interpreter, not merely the presence of py.exe.
python -c "import http.server" >nul 2>nul
if not errorlevel 1 goto use_python

py -3 -c "import http.server" >nul 2>nul
if not errorlevel 1 goto use_py

if not exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" goto missing_python
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" -c "import http.server" >nul 2>nul
if errorlevel 1 goto missing_python
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" -X utf8 "%~dp0run-local.py" %*
set "quick_drawn_exit=%errorlevel%"
goto finished

:use_python
python -X utf8 "%~dp0run-local.py" %*
set "quick_drawn_exit=%errorlevel%"
goto finished

:use_py
py -3 -X utf8 "%~dp0run-local.py" %*
set "quick_drawn_exit=%errorlevel%"
goto finished

:missing_python
echo Python 3 could not start. Install Python 3 and enable Add Python to PATH.
set "quick_drawn_exit=1"

:finished
if "%quick_drawn_exit%"=="0" exit /b 0
echo.
echo Quick Drawn could not start. Read the message above.
pause
exit /b %quick_drawn_exit%
