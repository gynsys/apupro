@echo off
setlocal EnableExtensions
title Instalador CostBase MDB Bridge
color 0B

set "DEST=%LOCALAPPDATA%\CostBaseBridge"
set "PS32=%WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
set "LOG=%USERPROFILE%\Desktop\CostBaseBridge_install.log"
set "BASE=https://costbase.net/tools"

echo.
echo ============================================
echo   Instalador CostBase MDB Bridge
echo ============================================
echo.
echo Carpeta destino:
echo   %DEST%
echo.

>>"%LOG%" echo [%DATE% %TIME%] Inicio instalacion

if not exist "%PS32%" (
    echo ERROR: no se encontro PowerShell de 32 bits.
    >>"%LOG%" echo ERROR: no se encontro PowerShell de 32 bits.
    pause
    exit /b 1
)

mkdir "%DEST%" 2>nul

echo Descargando puente...
>>"%LOG%" echo Descargando puente...

if exist "%WINDIR%\System32\curl.exe" (
    "%WINDIR%\System32\curl.exe" -L -s -S -o "%DEST%\CostBaseMDBBridge.ps1" "%BASE%/CostBaseMDBBridge.ps1"
    "%WINDIR%\System32\curl.exe" -L -s -S -o "%DEST%\Iniciar_Puente_CostBase.cmd" "%BASE%/Iniciar_Puente_CostBase.cmd"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Uri '%BASE%/CostBaseMDBBridge.ps1' -OutFile '%DEST%\CostBaseMDBBridge.ps1'; Invoke-WebRequest -UseBasicParsing -Uri '%BASE%/Iniciar_Puente_CostBase.cmd' -OutFile '%DEST%\Iniciar_Puente_CostBase.cmd'"
)

if not exist "%DEST%\CostBaseMDBBridge.ps1" (
    echo ERROR: no se pudo descargar el puente.
    echo Revise la conexion a internet o el antivirus.
    >>"%LOG%" echo ERROR: no se pudo descargar el puente.
    pause
    exit /b 1
)

if not exist "%DEST%\Iniciar_Puente_CostBase.cmd" (
    echo ERROR: no se pudo descargar el lanzador.
    >>"%LOG%" echo ERROR: no se pudo descargar el lanzador.
    pause
    exit /b 1
)

echo Creando inicio automatico...
>>"%LOG%" echo Creando inicio automatico...

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\CostBase MDB Bridge.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%LNK%'); $s.TargetPath = '%PS32%'; $s.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%DEST%\CostBaseMDBBridge.ps1\"'; $s.WorkingDirectory = '%DEST%'; $s.WindowStyle = 7; $s.Save()"

echo Iniciando puente...
>>"%LOG%" echo Iniciando puente...

start "" /min "%DEST%\Iniciar_Puente_CostBase.cmd"

echo.
echo ============================================
echo   Instalacion terminada
echo ============================================
echo.
echo Verifique en el navegador:
echo   http://127.0.0.1:8765/health
echo.
echo Si no aparece, revise:
echo   %DEST%\bridge.log
echo.
>>"%LOG%" echo [%DATE% %TIME%] Fin instalacion
pause
