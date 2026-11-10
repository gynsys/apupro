@echo off
setlocal
set "SCRIPT=%~dp0CostBaseMDBBridge.ps1"
set "PS32=%WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%SCRIPT%" (
    echo No se encontro CostBaseMDBBridge.ps1.
    pause
    exit /b 1
)

if not exist "%PS32%" (
    echo No se encontro PowerShell de 32 bits.
    pause
    exit /b 1
)

"%PS32%" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT%"
