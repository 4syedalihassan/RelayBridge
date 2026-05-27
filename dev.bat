@echo off
:: Start the Discord -> Global Relay Bridge in development mode
:: Run from project root: dev.bat

set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo.
echo  DiscordToGlobalRelay - Dev Mode
echo  ================================
echo  Mock GR Server: node tools/mock-gr-server/server.js
echo  Tauri app:      starting now...
echo.

:: Run tauri CLI from project root (tauri.conf.json is in src-tauri/)
:: using the CLI binary installed in packages/desktop-ui
.\packages\desktop-ui\node_modules\.bin\tauri dev
