@echo off
title Nethuna-WebAR Local Server
echo ========================================================
echo       Starting Nethuna-WebAR Local Server...
echo ========================================================
echo.
echo Opening browser at http://localhost:8000 ...
echo.
start http://localhost:8000
python -m http.server 8000
pause
