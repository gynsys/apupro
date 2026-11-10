@echo off
setlocal
set "SRC=%~dp0"
set "DEST=%LOCALAPPDATA%\CostBaseBridge"
set "PS32=%WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%SRC%CostBaseMDBBridge.ps1" (
    echo No se encontro CostBaseMDBBridge.ps1.
    echo Extraiga el ZIP completo antes de instalar.
    pause
    exit /b 1
)

if not exist "%PS32%" (
    echo No se encontro PowerShell de 32 bits.
    pause
    exit /b 1
)

mkdir "%DEST%" 2>nul
copy /Y "%SRC%CostBaseMDBBridge.ps1" "%DEST%\CostBaseMDBBridge.ps1" >nul
copy /Y "%SRC%Iniciar_Puente_CostBase.cmd" "%DEST%\Iniciar_Puente_CostBase.cmd" >nul

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\CostBase MDB Bridge.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%LNK%'); $s.TargetPath = '%PS32%'; $s.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%DEST%\CostBaseMDBBridge.ps1""'; $s.WorkingDirectory = '%DEST%'; $s.WindowStyle = 7; $s.Save()"

start "" /min "%DEST%\Iniciar_Puente_CostBase.cmd"

echo.
echo Puente instalado en:
echo   %DEST%
echo.
echo Se iniciara automaticamente al encender la laptop.
echo Prueba en el navegador:
echo   http://127.0.0.1:8765/health
echo.
pause
