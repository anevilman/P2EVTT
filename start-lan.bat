@echo off
setlocal
cd /d "%~dp0"

echo P2EVTT LAN server
echo.
echo This PC's IPv4 addresses:
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4"') do echo   %%A
echo.
echo Players open http://THIS-PC-IP:7788 in a browser.
echo Windows Firewall may ask to allow Node the first time — allow it on private networks.
echo.

pnpm dev -- --lan
if errorlevel 1 (
  echo.
  echo Failed to start. Need Node 22+ and pnpm in PATH. From this folder you can also run:
  echo   pnpm install
  echo   pnpm dev -- --lan
  pause
)
