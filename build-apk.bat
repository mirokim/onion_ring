@echo off
chcp 65001 >nul 2>&1
title Onion Ring - APK Build
cd /d "%~dp0"

echo.
echo  ============================================
echo   Onion Ring APK Build
echo  ============================================
echo.

REM ── Step 1: Synology Drive 소스를 로컬로 동기화 ──
echo  [1/4] Synology Drive 소스 동기화 중...
robocopy "C:\SynologyDrive\Drive\onion_ring\src" "C:\Dev\onion_ring\src" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
robocopy "C:\SynologyDrive\Drive\onion_ring\public" "C:\Dev\onion_ring\public" /MIR /NFL /NDL /NJH /NJS /nc /ns /np >nul 2>&1
copy /Y "C:\SynologyDrive\Drive\onion_ring\index.html" "C:\Dev\onion_ring\index.html" >nul 2>&1
copy /Y "C:\SynologyDrive\Drive\onion_ring\vite.config.ts" "C:\Dev\onion_ring\vite.config.ts" >nul 2>&1
copy /Y "C:\SynologyDrive\Drive\onion_ring\tsconfig.json" "C:\Dev\onion_ring\tsconfig.json" >nul 2>&1
copy /Y "C:\SynologyDrive\Drive\onion_ring\tsconfig.app.json" "C:\Dev\onion_ring\tsconfig.app.json" >nul 2>&1
copy /Y "C:\SynologyDrive\Drive\onion_ring\capacitor.config.ts" "C:\Dev\onion_ring\capacitor.config.ts" >nul 2>&1
echo  [OK] 소스 동기화 완료
echo.

REM ── Step 2: Vite 웹 빌드 ──
echo  [2/4] Vite 웹 빌드 중...
call npx tsc -b --noEmit
if errorlevel 1 (
    echo  [ERROR] TypeScript 타입 체크 실패!
    pause
    exit /b 1
)
call npx vite build
if errorlevel 1 (
    echo  [ERROR] Vite 빌드 실패!
    pause
    exit /b 1
)
echo  [OK] 웹 빌드 완료
echo.

REM ── Step 3: Capacitor sync ──
echo  [3/4] Capacitor sync 중...
call npx cap sync android
if errorlevel 1 (
    echo  [ERROR] Capacitor sync 실패!
    pause
    exit /b 1
)
echo  [OK] Capacitor sync 완료
echo.

REM ── Step 4: Gradle debug APK 빌드 ──
echo  [4/4] Debug APK 빌드 중... (첫 빌드는 수 분 소요)
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo  [ERROR] Gradle 빌드 실패!
    cd ..
    pause
    exit /b 1
)
cd ..
echo.

REM ── 완료 ──
echo  ============================================
echo   빌드 성공!
echo  ============================================
echo.
echo   APK 위치:
echo   android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo   Galaxy S24 설치 방법:
echo   1. USB 연결 후: adb install android\app\build\outputs\apk\debug\app-debug.apk
echo   2. 또는 APK 파일을 폰에 복사하여 직접 설치
echo.

REM ── Release APK 빌드가 필요할 경우 (서명 키 필요) ──
REM 1. 서명 키 생성 (최초 1회):
REM    keytool -genkeypair -v -keystore onion-ring.keystore -alias onion-ring -keyalg RSA -keysize 2048 -validity 10000
REM 2. android/app/build.gradle에 signingConfigs 추가
REM 3. cd android && gradlew.bat assembleRelease

pause
