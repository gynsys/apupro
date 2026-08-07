
import asyncio
import os
import subprocess
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

async def run_backup():
    """Ejecuta un backup de PostgreSQL usando pg_dump."""
    backup_dir = Path("backups")
    backup_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%md_%H%M%S")
    backup_file = backup_dir / f"auto_backup_{timestamp}.sql"
    
    # Connection info from env (inherited from settings usually)
    # But since we run in the backend container, we can use the same env vars
    db_name = os.getenv("POSTGRES_DB", "gynsys")
    db_user = os.getenv("POSTGRES_USER", "postgres")
    db_host = os.getenv("POSTGRES_SERVER", "db")
    
    logger.info(f"Iniciando backup automático: {backup_file}")
    
    try:
        # We assume the PGPASSWORD is set in env or using a .pgpass
        # Or we can just use the server default if configured
        command = [
            "pg_dump",
            "-h", db_host,
            "-U", db_user,
            "-d", db_name,
            "-f", str(backup_file)
        ]
        
        # Prepare environment with password
        env = os.environ.copy()
        db_password = os.getenv("POSTGRES_PASSWORD", "")
        env["PGPASSWORD"] = db_password

        # Run process
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            logger.info(f"Backup completado con éxito: {backup_file}")
            # Optional: compress or rotate
            rotate_backups(backup_dir)
        else:
            logger.error(f"Error en backup automático: {stderr.decode()}")
            
    except Exception as e:
        logger.error(f"Error inesperado durante el backup: {str(e)}")

def rotate_backups(backup_dir: Path, keep=10):
    """Mantiene solo los últimos N backups."""
    files = sorted(backup_dir.glob("auto_backup_*.sql"), key=os.path.getmtime)
    if len(files) > keep:
        for f in files[:-keep]:
            try:
                os.remove(f)
                logger.info(f"Rotación: Eliminando backup antiguo {f.name}")
            except Exception as e:
                logger.error(f"Error eliminando backup antiguo: {e}")

async def backup_scheduler(interval_seconds=3600):
    """Bucle infinito para el programador de backups."""
    logger.info(f"Programador de backups iniciado (Intervalo: {interval_seconds}s)")
    while True:
        await run_backup()
        await asyncio.sleep(interval_seconds)
