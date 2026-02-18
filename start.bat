@echo off
chcp 65001 >nul 2>&1
title Multi-AI Debate
cd /d "%~dp0"
echo.
echo  Multi-AI Debate 서버를 시작합니다...
echo.
npm run dev
pause
