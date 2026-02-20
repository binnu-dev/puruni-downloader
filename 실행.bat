@echo off
chcp 65001 >nul
title 📔 푸르니 알림장 백업 도구

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║                                                      ║
echo ║   📔 푸르니 어린이집 알림장 백업 도구                 ║
echo ║                                                      ║
echo ║   아이의 소중한 알림장 사진과 메시지를                ║
echo ║   내 컴퓨터에 저장합니다                              ║
echo ║                                                      ║
echo ╚══════════════════════════════════════════════════════╝
echo.

REM ─── Step 1: Node.js 확인 ───
echo [1/4] Node.js 확인 중...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ❌ Node.js가 설치되어 있지 않습니다!
    echo.
    echo    Node.js를 먼저 설치해야 합니다.
    echo    아래 방법 중 하나를 선택하세요:
    echo.
    echo    [방법 1] 자동 설치 (추천)
    echo    Windows 키를 누르고 "PowerShell"을 검색한 뒤
    echo    "관리자 권한으로 실행"을 클릭하고 아래를 복사 붙여넣기:
    echo.
    echo    winget install OpenJS.NodeJS.LTS
    echo.
    echo    [방법 2] 직접 다운로드
    echo    https://nodejs.org 에서 LTS 버전 다운로드 후 설치
    echo.
    echo    설치 후 이 파일을 다시 실행해주세요!
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo    ✅ Node.js %%i 발견

REM ─── Step 2: 필요 패키지 설치 ───
echo.
echo [2/4] 필요한 패키지 설치 중... (처음 한 번만 오래 걸립니다)
if not exist "node_modules\playwright" (
    call npm install
    echo    브라우저 설치 중... (약 1-2분 소요)
    call npx playwright install chromium
    echo    ✅ 설치 완료!
) else (
    echo    ✅ 이미 설치되어 있습니다
)

REM ─── Step 3: 로그인 정보 입력 ───
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  푸르니 로그인 정보를 입력해주세요                    ║
echo ║  (purunicare.com 에서 사용하는 아이디/비밀번호)       ║
echo ╚══════════════════════════════════════════════════════╝
echo.

set /p PURUNI_ID="   👤 아이디: "
set /p PURUNI_PW="   🔑 비밀번호: "

if "%PURUNI_ID%"=="" (
    echo ❌ 아이디를 입력해주세요!
    pause
    exit /b 1
)
if "%PURUNI_PW%"=="" (
    echo ❌ 비밀번호를 입력해주세요!
    pause
    exit /b 1
)

REM ─── Step 4: 다운로드 시작 ───
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  📥 다운로드를 시작합니다!                           ║
echo ║                                                      ║
echo ║  ⏱️  전체 다운로드에 약 40~60분 소요됩니다            ║
echo ║  🖥️  브라우저 창이 자동으로 열렸다 닫힙니다           ║
echo ║  ⚠️  완료될 때까지 이 창을 닫지 마세요!              ║
echo ╚══════════════════════════════════════════════════════╝
echo.

node scraper.js --id=%PURUNI_ID% --pw="%PURUNI_PW%" --headless=true

if %errorlevel% neq 0 (
    echo.
    echo ❌ 다운로드 중 오류가 발생했습니다.
    echo    아이디/비밀번호를 확인하고 다시 시도해주세요.
    echo.
    pause
    exit /b 1
)

REM ─── 완료! 뷰어 실행 ───
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  🎉 다운로드 완료!                                  ║
echo ║                                                      ║
echo ║  📁 사진과 메시지가 downloaded 폴더에 저장되었습니다  ║
echo ║  🌐 뷰어를 열어서 확인해보세요                       ║
echo ╚══════════════════════════════════════════════════════╝
echo.

set /p OPEN_VIEWER="   뷰어를 열까요? (Y/N): "
if /i "%OPEN_VIEWER%"=="Y" (
    echo    🌐 http://localhost:3000 에서 열립니다...
    echo    종료하려면 이 창에서 Ctrl+C를 누르세요.
    start http://localhost:3000
    node viewer.js
)

pause
