@echo off
echo ==========================================
echo    Despliegue de CostBase Platform (CI/CD)
echo ==========================================

REM Limpiar cualquier archivo de bloqueo huerfano de Git si existiera
if exist .git\index.lock (
    echo [i] Limpiando archivo de bloqueo de Git...
    del /f /q .git\index.lock >nul 2>&1
)

echo.
echo [1/2] Preparando cambios en Git...
git add .

set /p commit_msg="Ingresa el mensaje del commit (Enter para 'Actualizacion'): "
if "%commit_msg%"=="" set commit_msg=Actualizacion

git commit -m "%commit_msg%" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [i] No hay cambios nuevos sin commitear o ya fueron registrados.
)

echo.
echo [2/2] Subiendo cambios a GitHub (git push origin main)...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Hubo un error al ejecutar git push. Revisa tu conexion a Internet o credenciales.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==========================================
echo    Despliegue iniciado en GitHub Actions!
echo ==========================================
echo El proceso de compilacion y despliegue en DigitalOcean 
echo ahora se esta ejecutando automaticamente en la nube de GitHub.
echo.
echo Puedes ver el progreso en tiempo real aqui:
echo https://github.com/gynsys/apupro/actions
echo.
pause
