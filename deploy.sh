#!/bin/bash
# Script de despliegue automático para el servidor
# Uso: ./deploy.sh

set -e  # Salir si hay algún error

echo "🚀 Iniciando despliegue..."

# Cambiar al directorio del proyecto
cd "$(dirname "$0")"

# Actualizar código desde GitHub
# Actualizar código desde GitHub (solo si es un repo git)
if [ -d ".git" ]; then
    echo "📥 Actualizando código desde GitHub..."
    git pull origin main
else
    echo "📂 Despliegue manual detectado (sin git). Saltando actualización."
fi

# Activar entorno virtual (ajustar ruta según tu servidor)
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "../venv" ]; then
    source ../venv/bin/activate
else
    echo "⚠️  Entorno virtual no encontrado. Ajusta la ruta en el script."
fi

# Actualizar dependencias
echo "📦 Actualizando dependencias..."
python3 -m pip install -r requirements.txt --quiet

# 🆕 BACKUP DE BASE DE DATOS
echo "💾 Creando backup de base de datos..."
if [ -f "database/medical_bot.db" ]; then
    BACKUP_FILE="database/medical_bot.db.backup-$(date +%Y%m%d-%H%M%S)"
    cp database/medical_bot.db "$BACKUP_FILE"
    echo "✅ Backup creado: $BACKUP_FILE"
else
    echo "⚠️  Base de datos no encontrada. Saltando backup."
fi

# 🆕 EJECUTAR MIGRACIONES DE BASE DE DATOS
echo "🔄 Ejecutando migraciones de base de datos..."
if command -v alembic &> /dev/null; then
    alembic upgrade head
    echo "✅ Migraciones aplicadas correctamente"
else
    echo "⚠️  Alembic no encontrado. Verifica la instalación."
fi

# Reiniciar el bot
echo "🔄 Reiniciando el bot..."
pkill -f "python main.py" || true  # No fallar si el proceso no existe
sleep 2

# Iniciar el bot en segundo plano
echo "▶️  Iniciando bot..."
nohup python main.py > bot.log 2>&1 &

echo ""
echo "✅ Despliegue completado"
echo "📋 Ver logs con: tail -f bot.log"
echo "🔍 Verificar proceso: ps aux | grep 'python main.py'"

