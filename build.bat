@echo off
:: Build the RelayBridge MSI Installer in production mode
:: Run from project root: build.bat

set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo.
echo  RelayBridge - Production Build Mode
echo  ====================================
echo  Tauri app:      building installer now...
echo.

:: Run tauri CLI from project root (tauri.conf.json is in src-tauri/)
:: using the CLI binary installed in packages/desktop-ui
.\packages\desktop-ui\node_modules\.bin\tauri build
