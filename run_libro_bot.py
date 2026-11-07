"""Lanzador del Bot exclusivo para Libro de Obra Digital.

Ejecuta: python run_libro_bot.py
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from libro_obra_bot.bot import main

if __name__ == "__main__":
    main()
