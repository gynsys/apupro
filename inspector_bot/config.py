"""
Configuración central del Bot de Inspección de Obras.
"""
import os
from pathlib import Path

# Token de autenticación del Bot en Telegram (suministrado por @BotFather)
BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "8853208267:AAGt7qEeFZuKf4QWEV6c-w2dtfTsT34VtsA")

# Directorios de almacenamiento de archivos
BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BASE_DIR / "data"
PHOTOS_DIR: Path = DATA_DIR / "photos"
PDFS_DIR: Path = DATA_DIR / "pdfs"

for folder in (DATA_DIR, PHOTOS_DIR, PDFS_DIR):
    folder.mkdir(parents=True, exist_ok=True)
