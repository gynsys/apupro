"""
Configuración central del Bot de Inspección de Obras.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde .env raíz o del sistema
ROOT_DIR: Path = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# Token de autenticación del Bot en Telegram (suministrado por @BotFather)
BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "8853208267:AAFNyzrFiftKjRIfWeOeft89dsgYdDXRoP8")

# Directorios de almacenamiento de archivos
BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BASE_DIR / "data"
PHOTOS_DIR: Path = DATA_DIR / "photos"
PDFS_DIR: Path = DATA_DIR / "pdfs"

for folder in (DATA_DIR, PHOTOS_DIR, PDFS_DIR):
    folder.mkdir(parents=True, exist_ok=True)
