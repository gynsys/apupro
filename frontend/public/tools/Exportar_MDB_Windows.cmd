@echo off
setlocal
set "SCRIPT=%~dp0exportar_mdb_windows.ps1"
set "PS32=%WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%SCRIPT%" (
    echo No se encontro exportar_mdb_windows.ps1 en esta carpeta.
    echo Extraiga el ZIP completo antes de ejecutar este archivo.
    pause
    exit /b 1
)

if not exist "%PS32%" (
    echo No se encontro PowerShell de 32 bits.
    pause
    exit /b 1
)

"%PS32%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
echo.
pause
