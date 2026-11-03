@echo off
title Desplegar Inspector Bot en DigitalOcean
echo ========================================================
echo       DESPLEGANDO INSPECTOR BOT EN DIGITALOCEAN
echo ========================================================
echo.
cd /d "%~dp0"
tar -czf inspector_deploy.tar.gz inspector_bot run_inspector_bot.py credentials.json requirements_inspector.txt .env
python ssh_runner.py --upload inspector_deploy.tar.gz /root/apupro_platform/inspector_deploy.tar.gz
del inspector_deploy.tar.gz
python ssh_runner.py "cd /root/apupro_platform && tar -xzf inspector_deploy.tar.gz && rm -f inspector_deploy.tar.gz && systemctl restart inspector_bot.service && systemctl status inspector_bot.service --no-pager"
echo.
echo ========================================================
echo        DESPLIEGUE FINALIZADO EXITOSAMENTE
echo ========================================================
pause
