"""Configuración central del Bot de Libro de Obra Digital."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde .env raíz o del sistema
ROOT_DIR: Path = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# Token de autenticación del Bot en Telegram (suministrado por @BotFather)
# Permite variable dedicada TELEGRAM_LIBRO_BOT_TOKEN o la general TELEGRAM_BOT_TOKEN
BOT_TOKEN: str = os.getenv("TELEGRAM_LIBRO_BOT_TOKEN", os.getenv("TELEGRAM_BOT_TOKEN", "8853208267:AAGU3Ib1C4eFFJrygK8mya4dSUoWqv-RaUY"))

# Clave opcional de OpenAI para el generador inteligente de descripciones de labor
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

# Directorios de almacenamiento de archivos
BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BASE_DIR / "data"
LIBROS_DIR: Path = DATA_DIR / "libros_de_obra"
PHOTOS_DIR: Path = DATA_DIR / "photos"

for folder in (DATA_DIR, LIBROS_DIR, PHOTOS_DIR):
    folder.mkdir(parents=True, exist_ok=True)
