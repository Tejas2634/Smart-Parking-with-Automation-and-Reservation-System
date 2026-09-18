@echo off
title Smart Parking 1-Click Cloud Deployer
color 0b
echo ================================================================
echo    SmartPark Jalgaon - Automated Cloud Deployment Helper
echo ================================================================
echo.

cd /d "C:\Users\thete\.gemini\antigravity\scratch\smart_parking_system"

echo [1/3] Checking Git Status and preparing production bundle...
git add .
git commit -m "Deploy Smart Parking System to Cloud" >nul 2>&1
git branch -M main

echo.
echo ================================================================
echo  To make your website live 24/7 forever, create a free repo at:
echo    https://github.com/new (Name: smart-parking-system)
echo ================================================================
echo.
set /p REPO_URL="Paste your GitHub Repository URL (e.g. https://github.com/yourname/smart-parking-system.git): "

if "%REPO_URL%"=="" (
    echo No URL entered. Aborting.
    pause
    exit /b
)

echo.
echo [2/3] Linking and Pushing code to GitHub...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git push -u origin main --force

echo.
echo [3/3] Opening Render.com 1-Click Free Hosting in your browser...
start https://dashboard.render.com/select-repo?type=web

echo.
echo ================================================================
echo   SUCCESS! 
echo   On Render.com, select your repository and click Deploy!
echo   Your website will stay live 24/7 forever on the cloud.
echo ================================================================
echo.
pause
