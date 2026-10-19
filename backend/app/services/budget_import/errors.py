"""Errores de dominio del importador de presupuestos desde archivo."""


class BudgetImportError(Exception):
    """Error controlado del flujo de importación (se traduce a HTTP 4xx)."""


class UnsupportedFileTypeError(BudgetImportError):
    """La extensión del archivo no está soportada."""


class FileExtractionError(BudgetImportError):
    """No se pudo leer el contenido del archivo (Excel, PDF o imagen)."""


class OCRError(BudgetImportError):
    """No se pudo aplicar OCR a una imagen o PDF escaneado."""


class StructuringError(BudgetImportError):
    """La IA no pudo convertir el texto extraído en partidas estructuradas."""
