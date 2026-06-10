@echo off
cd /d "%~dp0"
echo.
echo Netflix 영화 페이지 서버를 시작합니다...
echo 브라우저에서 http://localhost:3000 으로 접속하세요.
echo.
echo [중요] 이 창을 닫으면 서버가 종료됩니다.
echo.
npm start
pause
