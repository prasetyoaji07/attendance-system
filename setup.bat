@echo off
setlocal
title Setup Sistem Absensi
echo ============================================
echo   SETUP SISTEM ABSENSI
echo ============================================
where node >nul 2>nul
if errorlevel 1 goto :nonode
for /f "tokens=*" %%v in ('node -v') do echo Node %%v terdeteksi
echo.

echo [1/4] Menyiapkan file .env
if not exist server\.env copy server\.env.example server\.env >nul
if not exist client\.env copy client\.env.example client\.env >nul
echo   OK. Edit server\.env untuk isi DB dan secret.
echo.

echo [2/4] Install dependency root
call npm install || goto :error
echo [3/4] Install dependency server
call npm install --prefix server || goto :error
echo [4/4] Install dependency client
call npm install --prefix client || goto :error

if not exist .git git init >nul 2>nul

echo.
echo ============================================
echo   SELESAI
echo ============================================
echo Langkah berikutnya:
echo   1. Isi koneksi DB di server\.env
echo   2. npm run dev      (API :3001 dan web :5173)
echo   3. npm test         (unit test server)
echo   4. Buka CLAUDE.md dan docs\TASKS.md untuk lanjut coding
pause
exit /b 0

:nonode
echo [X] Node.js belum terpasang. Install versi LTS dari nodejs.org lalu jalankan ulang.
pause
exit /b 1

:error
echo [X] Install gagal. Cek pesan error di atas.
pause
exit /b 1
