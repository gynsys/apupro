@echo off
echo ==========================================
echo    Despliegue de APUpro Platform (CI/CD)
echo ==========================================

echo.
echo [1/2] Añadiendo cambios a Git...
git add .
set /p commit_msg="Ingresa el mensaje del commit (deja vacio para 'Actualizacion'): "
if "%commit_msg%"=="" set commit_msg=Actualizacion

git commit -m "%commit_msg%"

echo.
echo [2/2] Subiendo cambios a GitHub (git push)...
git push

echo.
echo ==========================================
echo    ¡Despliegue iniciado en GitHub Actions!
echo ==========================================
echo El proceso de compilacion y despliegue en DigitalOcean 
echo ahora se esta ejecutando automaticamente en la nube de GitHub.
echo.
echo Puedes ver el progreso en tiempo real aqui:
echo https://github.com/gynsys/apupro/actions
echo.
pause
