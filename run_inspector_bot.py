"""
Lanzador del Bot de Inspección de Obras.
Ejecuta: python run_inspector_bot.py
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from inspector_bot.bot import main

if __name__ == "__main__":
    main()
