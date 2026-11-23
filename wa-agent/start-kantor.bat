@echo off
title CCE WhatsApp AI Agent Server (OpenWA + Next.js)
echo ====================================================
echo   Menyalakan CCE WhatsApp AI Agent (Komputer Kantor)
echo ====================================================
echo.

cd /d "%~dp0"

echo [1/3] Menunggu Docker Desktop siap...
set /a tries=0
:wait_docker
docker info >nul 2>&1
if %errorlevel%==0 goto docker_ready
set /a tries+=1
if %tries% geq 18 (
    echo [ERROR] Docker Desktop belum berjalan setelah 90 detik.
    echo Pastikan Docker Desktop sudah terpasang dan terbuka, lalu coba lagi.
    pause
    exit /b 1
)
timeout /t 5 /nobreak >nul
goto wait_docker

:docker_ready
echo [2/3] Menyalakan container OpenWA (Baileys, port 2785)...
docker compose up -d
if errorlevel 1 (
    echo [ERROR] Gagal menjalankan container OpenWA.
    pause
    exit /b 1
)

cd /d "%~dp0\.."

if not exist ".env.local" (
    echo [PERINGATAN] File .env.local belum ditemukan di %CD%!
    echo Salin .env.local dari laptop dan isi OPENWA_API_KEY sebelum memakai bot WA.
    pause
)

if not exist ".next" (
    echo [INFO] Folder build .next belum ada. Menjalankan npm run build pertama kali...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Gagal build aplikasi CCE.
        pause
        exit /b 1
    )
)

echo [3/3] Menyalakan server produksi CCE di http://0.0.0.0:3000 ...
echo Biarkan jendela ini tetap terbuka (boleh di-minimize).
echo Tekan Ctrl+C untuk menghentikan server.
echo.
set PORT=3000
set HOSTNAME=0.0.0.0
call npm run start -- -H 0.0.0.0 -p 3000
pause

