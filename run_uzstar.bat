@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python topilmadi. Python 3.10 yoki yangiroq versiyani o'rnating.
  echo https://www.python.org/downloads/
  pause
  exit /b 1
)

REM Har ishga tushishda yangi port tanlanadi: eski UZStar Service Worker keshini chetlab o'tadi.
set "UZSTAR_PORT="
for /f %%P in ('powershell -NoProfile -Command "$p=Get-Random -Minimum 18000 -Maximum 45000; for($i=0;$i -lt 2000;$i++){ $l=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$p); try { $l.Start(); $l.Stop(); Write-Output $p; exit } catch { $p++; if($p -gt 50000){$p=18000} } }"') do set "UZSTAR_PORT=%%P"
if "%UZSTAR_PORT%"=="" (
  echo Bo'sh port topilmadi. Boshqa dasturlarni yopib qayta urinib ko'ring.
  pause
  exit /b 1
)

start "UZStar Server 2.9 Pro" /D "%~dp0" cmd /k "set UZSTAR_PORT=%UZSTAR_PORT% && python server.py"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%UZSTAR_PORT%/"
echo.
echo UZStar 2.9 Pro manzili: http://127.0.0.1:%UZSTAR_PORT%/
echo Har ishga tushirishda yangi port tanlanadi, eski sahifa keshi ishlatilmaydi.
echo Server oynasini yopmang.
