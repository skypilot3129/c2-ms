@echo off
title Update CCE AI Agent Kantor
echo ====================================================
echo   Update Kode CCE & OpenWA di Komputer Kantor
echo ====================================================
echo.
echo Pastikan jendela start-kantor.bat sudah ditutup sebelum lanjut!
pause

cd /d "%~dp0\.."

echo.
echo [1/4] Mengambil kode terbaru dari GitHub...
git pull origin main
if errorlevel 1 (
    echo [ERROR] git pull gagal. Periksa koneksi internet atau status git.
    pause
    exit /b 1
)

echo.
echo [2/4] Memperbarui dependensi npm...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install gagal.
    pause
    exit /b 1
)

echo.
echo [3/4] Build ulang versi produksi CCE...
call npm run build
if errorlevel 1 (
    echo [ERROR] npm run build gagal.
    pause
    exit /b 1
)

echo.
echo [4/4] Update image Docker OpenWA (jika ada versi baru)...
cd /d "%~dp0"
docker compose pull
docker compose up -d

echo.
echo ====================================================
echo   Update selesai! Klik 2x start-kantor.bat lagi.
echo ====================================================
pause

