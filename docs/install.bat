@echo off
:: ============================================================
:: SELF-ELEVATION BLOCK
:: ============================================================
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Administrative privileges required. 
    echo Requesting elevation from user...
    
    :: Use PowerShell to relaunch this exact file with the 'RunAs' verb
    powershell -NoProfile -Command "Start-Process -FilePath '%0' -ArgumentList 'am_admin' -Verb RunAs"
    exit /b
)
:: ============================================================

echo Checking for winget...
powershell -NoProfile -Command "Get-Command winget" >nul 2>nul
if errorlevel 1 (
    echo [!] winget not found. Attempting to install it...
    
    echo Registering system AppInstaller...
    powershell -NoProfile -Command "Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe" >nul 2>nul
    
    powershell -NoProfile -Command "Get-Command winget" >nul 2>nul
    if errorlevel 1 (
        echo Fetching latest winget bundle from Microsoft...
        powershell -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://aka.ms/getwinget' -OutFile '$env:TEMP\winget.msixbundle'; Add-AppxPackage -Path '$env:TEMP\winget.msixbundle'"
    )
    
    powershell -NoProfile -Command "Get-Command winget" >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Failed to install winget automatically. 
        echo Please install "App Installer" manually from the Microsoft Store.
        pause
        exit /b 1
    )
    echo [OK] winget successfully installed!
) else (
    echo [OK] winget is already available.
)

echo.
echo Installing Node.js LTS...
winget install OpenJS.NodeJS.LTS --source winget --accept-source-agreements --accept-package-agreements

echo.
echo Installing Docker Desktop...
winget install --id Docker.DockerDesktop --source winget --accept-source-agreements --accept-package-agreements

echo.
echo ============================================================
echo [SUCCESS] Installations complete. 
echo Please restart your computer to apply Docker VM features and update PATH!
echo ============================================================
pause
