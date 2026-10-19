"""Extracción de contenido de archivos de presupuesto (Excel, CSV, PDF e imágenes)."""
import io
import logging
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from PIL import Image, ImageOps

from sqlalchemy.orm import Session

from .errors import FileExtractionError, UnsupportedFileTypeError
from .ocr import ocr_images

logger = logging.getLogger(__name__)

EXCEL_EXTENSIONS = {".xlsx", ".xlsm", ".xls"}
CSV_EXTENSIONS = {".csv"}
PDF_EXTENSIONS = {".pdf"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

MAX_EXCEL_ROWS = 800
MAX_EXCEL_SHEETS = 12
MAX_PDF_PAGES = 20
MAX_OCR_PAGES = 8
MAX_TEXT_CHARS = 60_000

# ---------------------------------------------------------------------------
# Normalización y utilidades
# ---------------------------------------------------------------------------

_DESC_ALIASES = {
    "descripcion", "descripcion de partida", "descripcion de la partida",
    "descripcion del trabajo", "descripcion de trabajo", "concepto",
    "concepto de obra", "detalle", "actividad", "actividades", "rubro",
    "trabajo", "desc", "descripcion de actividad",
}
_CODE_ALIASES = {
    "codigo", "codigo covenin", "codigo de partida", "codigo partida",
    "covpar", "cov par", "codpar", "cod par", "cod", "nro", "numero",
    "num", "no", "n", "item", "partida", "n de partida", "nro de partida",
}
_UNIT_ALIASES = {
    "unidad", "unidad de medida", "unidad medida", "und", "un", "ud", "um",
    "u m", "uni", "medida", "u",
}
_QTY_ALIASES = {
    "cantidad", "cantidad de obra", "cant de obra", "cant", "metrado",
    "metraje", "qty", "cantidades",
}

_STOP_DESCRIPTIONS = (
    "total", "subtotal", "gran total", "total general", "monto total",
    "iva", "i.v.a", "observaciones", "observacion", "nota", "notas",
    "elaborado por", "aprobado por", "fecha", "pagina", "firma", "sello",
)

_CHAPTER_RE = re.compile(
    r"^(cap[ií]tulo|secci[oó]n|rubro|partida|etapa|fase)\b", re.IGNORECASE
)

_UNIT_NORMALIZATION = {
    "m2": "m2", "m²": "m2", "mts2": "m2", "mt2": "m2", "metros cuadrados": "m2",
    "m3": "m3", "m³": "m3", "mts3": "m3", "mt3": "m3", "metros cubicos": "m3",
    "ml": "m", "m": "m", "mts": "m", "mt": "m", "metro": "m", "metros": "m",
    "metro lineal": "m", "metros lineales": "m",
    "und": "und", "un": "und", "ud": "und", "u": "und", "unidad": "und",
    "unidades": "und", "pza": "pza", "pzas": "pza", "pieza": "pza",
    "piezas": "pza", "pz": "pza",
    "kg": "kg", "kgs": "kg", "kgf": "kgf", "kilogramo": "kg", "kilos": "kg",
    "ton": "ton", "tonf": "ton", "tonelada": "ton", "toneladas": "ton",
    "sco": "sco", "saco": "sco", "sacos": "sco", "bolsa": "sco",
    "gal": "gal", "gln": "gal", "galon": "gal", "galones": "gal",
    "lt": "lt", "l": "lt", "litro": "lt", "litros": "lt",
    "dia": "día", "día": "día", "dias": "día", "días": "día",
    "hr": "hr", "hora": "hr", "horas": "hr",
    "gl": "gl", "global": "gl", "suma global": "gl",
    "pto": "pto", "punto": "pto", "puntos": "pto",
    "mes": "mes", "sem": "sem", "semana": "sem",
    "rll": "rll", "rollo": "rll", "rollos": "rll",
    "cuñ": "cuñ", "cun": "cuñ",
    "doc": "doc", "docena": "doc",
}


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _normalize_header(value: Any) -> str:
    if value is None:
        return ""
    text = _strip_accents(str(value)).lower().strip()
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _clean_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    if text.lower() in {"nan", "none", "nat"}:
        return ""
    return re.sub(r"\s+", " ", text)


def _normalize_unit(value: Any) -> str:
    raw = _clean_cell(value)
    if not raw:
        return ""
    key = _normalize_header(raw)
    if key in _UNIT_NORMALIZATION:
        return _UNIT_NORMALIZATION[key]
    return raw[:12].lower()


def parse_quantity(value: Any) -> Optional[float]:
    """Convierte cantidades venezolanas/internacionales a float."""
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    raw = raw.replace("\u00a0", " ")
    raw = re.sub(r"[^0-9,.\-]", "", raw)
    if not raw or raw in {"-", ".", ","}:
        return None

    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw:
        parts = raw.split(",")
        if len(parts) == 2 and 1 <= len(parts[1]) <= 2:
            raw = raw.replace(",", ".")
        else:
            raw = raw.replace(",", "")
    try:
        number = float(raw)
    except ValueError:
        return None
    if number < 0 or number > 1_000_000_000:
        return None
    return number


def _is_chapter(description: str, quantity: Optional[float], unit: str) -> bool:
    if quantity is not None and quantity > 0:
        return False
    if unit:
        return False
    text = description.strip()
    if not text:
        return False
    if _CHAPTER_RE.match(text):
        return True
    letters = [ch for ch in text if ch.isalpha()]
    if len(text) <= 90 and letters and text.upper() == text:
        return True
    return False


def _looks_like_stop_row(description: str) -> bool:
    normalized = _normalize_header(description)
    if not normalized:
        return True
    return any(normalized == stop or normalized.startswith(stop + " ") for stop in _STOP_DESCRIPTIONS)


def _extract_header_meta(rows: List[List[str]], header_index: int, filename: str) -> Dict[str, Any]:
    header: Dict[str, Any] = {
        "budget_name": Path(filename).stem.replace("_", " ").replace("-", " ").strip().title(),
        "project_name": None,
        "client_name": None,
        "currency": "USD",
    }
    joined = " ".join(cell for row in rows[: max(0, header_index)] for cell in row)
    upper = joined.upper()
    if any(token in upper for token in ("BS.", "BSF", "VES", "BOLIVAR", "BOLÍVAR")):
        header["currency"] = "VES"
    elif any(token in upper for token in ("USD", "US$", "$")):
        header["currency"] = "USD"

    for row in rows[: max(0, header_index)]:
        cells = [_clean_cell(cell) for cell in row]
        for cell_index, text in enumerate(cells):
            if not text:
                continue
            match = re.match(r"^(proyecto|obra)\s*[:\-]\s*(.+)$", text, re.IGNORECASE)
            if match and not header["project_name"]:
                header["project_name"] = match.group(2).strip()[:250]
            elif re.match(r"^(proyecto|obra)\s*[:\-]?\s*$", text, re.IGNORECASE):
                value = next((cell for cell in cells[cell_index + 1:] if cell), "")
                if value and not header["project_name"]:
                    header["project_name"] = value[:250]

            match = re.match(r"^(cliente|contratante|propietario)\s*[:\-]\s*(.+)$", text, re.IGNORECASE)
            if match and not header["client_name"]:
                header["client_name"] = match.group(2).strip()[:250]
            elif re.match(r"^(cliente|contratante|propietario)\s*[:\-]?\s*$", text, re.IGNORECASE):
                value = next((cell for cell in cells[cell_index + 1:] if cell), "")
                if value and not header["client_name"]:
                    header["client_name"] = value[:250]

            match = re.match(r"^presupuesto\s*[:\-]\s*(.+)$", text, re.IGNORECASE)
            if match:
                header["budget_name"] = match.group(1).strip()[:250]
    return header


def _find_header(df: pd.DataFrame) -> Optional[Tuple[int, Dict[str, int]]]:
    best: Optional[Tuple[int, int, Dict[str, int]]] = None
    for row_index in range(min(len(df), 40)):
        cells = [_normalize_header(value) for value in df.iloc[row_index].tolist()]
        desc_col = next((i for i, cell in enumerate(cells) if cell in _DESC_ALIASES), None)
        qty_col = next((i for i, cell in enumerate(cells) if cell in _QTY_ALIASES), None)
        unit_col = next((i for i, cell in enumerate(cells) if cell in _UNIT_ALIASES), None)
        code_col = next(
            (i for i, cell in enumerate(cells) if cell in _CODE_ALIASES and i != desc_col),
            None,
        )

        # Algunos presupuestos titulan la columna de descripción como "Partida".
        if desc_col is None and code_col is not None and cells[code_col] == "partida":
            desc_col = code_col
            code_col = None

        if desc_col is None or (qty_col is None and unit_col is None):
            continue

        score = (3 if desc_col is not None else 0) + (3 if qty_col is not None else 0)
        score += 1 if unit_col is not None else 0
        score += 1 if code_col is not None else 0
        roles = {
            "description": desc_col,
        }
        if qty_col is not None:
            roles["quantity"] = qty_col
        if unit_col is not None:
            roles["unit"] = unit_col
        if code_col is not None and code_col != desc_col:
            roles["code"] = code_col

        if best is None or score > best[0]:
            best = (score, row_index, roles)
    if not best:
        return None
    return best[1], best[2]


def _parse_sheet(df: pd.DataFrame, filename: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[str]]:
    items: List[Dict[str, Any]] = []
    warnings: List[str] = []
    if df is None or df.empty:
        return items, {}, warnings

    df = df.iloc[:MAX_EXCEL_ROWS]
    header_info = _find_header(df)
    if not header_info:
        return items, {}, warnings

    header_row, columns = header_info
    rows = df.values.tolist()
    header_meta = _extract_header_meta(
        [[_clean_cell(cell) for cell in row] for row in rows], header_row, filename
    )

    for row in rows[header_row + 1:]:
        cells = [_clean_cell(cell) for cell in row]

        def value_of(role: str) -> str:
            index = columns.get(role)
            if index is None or index >= len(cells):
                return ""
            return cells[index]

        description = value_of("description")
        if not description or len(description) < 3 or _looks_like_stop_row(description):
            continue

        quantity = parse_quantity(value_of("quantity")) if "quantity" in columns else None
        unit = _normalize_unit(value_of("unit")) if "unit" in columns else ""
        code = value_of("code")
        is_chapter = _is_chapter(description, quantity, unit)

        if not is_chapter and not unit:
            unit = "und"
        if not is_chapter and quantity is None:
            quantity = 0.0

        items.append({
            "code": code[:80],
            "description": description[:600],
            "unit": "" if is_chapter else (unit or "und"),
            "quantity": 0.0 if is_chapter else float(quantity or 0.0),
            "is_chapter": is_chapter,
        })

    return items, header_meta, warnings


def _sheet_to_text(df: pd.DataFrame, sheet_name: str, max_rows: int = 250) -> str:
    lines: List[str] = [f"### HOJA: {sheet_name}"]
    for row in df.iloc[:max_rows].values.tolist():
        cells = [_clean_cell(cell) for cell in row]
        cells = [cell for cell in cells if cell]
        if cells:
            lines.append(" | ".join(cells))
    return "\n".join(lines)


def _read_excel(data: bytes, filename: str) -> Dict[str, pd.DataFrame]:
    try:
        return pd.read_excel(
            io.BytesIO(data),
            sheet_name=None,
            header=None,
            dtype=str,
            keep_default_na=False,
        )
    except ImportError as exc:
        raise FileExtractionError(
            "Para leer archivos .xls antiguos el servidor necesita la librería xlrd. "
            "Guarda el archivo como .xlsx e inténtalo de nuevo."
        ) from exc
    except Exception as exc:
        logger.error("No se pudo leer el Excel %s: %s", filename, exc, exc_info=True)
        raise FileExtractionError(f"No se pudo leer el archivo Excel: {exc}") from exc


def _extract_excel(data: bytes, filename: str) -> Dict[str, Any]:
    sheets = _read_excel(data, filename)
    all_items: List[Dict[str, Any]] = []
    header: Dict[str, Any] = {}
    text_parts: List[str] = []

    for sheet_name, df in list(sheets.items())[:MAX_EXCEL_SHEETS]:
        if df is None or df.empty:
            continue
        items, sheet_header, _ = _parse_sheet(df, filename)
        if items:
            all_items.extend(items)
            header = header or sheet_header
        else:
            text_parts.append(_sheet_to_text(df, str(sheet_name)))

    if all_items:
        return {
            "source_type": "excel",
            "items": all_items[:500],
            "header": header,
            "text": "",
            "warnings": [],
        }

    text = "\n\n".join(text_parts).strip()[:MAX_TEXT_CHARS]
    if not text:
        raise FileExtractionError("El archivo Excel no contiene filas legibles.")
    return {
        "source_type": "excel",
        "items": [],
        "header": {},
        "text": text,
        "warnings": [
            "No se detectó una tabla con columnas de descripción y cantidad; "
            "se usará IA para interpretar el contenido."
        ],
    }


def _read_csv(data: bytes, filename: str) -> pd.DataFrame:
    last_error: Optional[Exception] = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        for separator in (None, ";", ","):
            try:
                df = pd.read_csv(
                    io.BytesIO(data),
                    header=None,
                    dtype=str,
                    keep_default_na=False,
                    sep=separator,
                    engine="python",
                    encoding=encoding,
                )
                if df.shape[1] >= 2:
                    return df
            except Exception as exc:  # noqa: PERF203
                last_error = exc
    logger.error("No se pudo leer el CSV %s: %s", filename, last_error, exc_info=True)
    raise FileExtractionError(f"No se pudo leer el archivo CSV: {last_error}")


def _extract_csv(data: bytes, filename: str) -> Dict[str, Any]:
    df = _read_csv(data, filename)
    items, header, _ = _parse_sheet(df, filename)
    if items:
        return {
            "source_type": "csv",
            "items": items[:500],
            "header": header,
            "text": "",
            "warnings": [],
        }
    text = _sheet_to_text(df, "CSV")[:MAX_TEXT_CHARS]
    if not text:
        raise FileExtractionError("El archivo CSV no contiene filas legibles.")
    return {
        "source_type": "csv",
        "items": [],
        "header": {},
        "text": text,
        "warnings": ["No se detectó una tabla clara; se usará IA para interpretar el contenido."],
    }


def _render_pdf_pages(doc, max_pages: int) -> List[Image.Image]:
    images: List[Image.Image] = []
    for page in doc:
        if len(images) >= max_pages:
            break
        try:
            pix = page.get_pixmap(dpi=170)
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        except Exception as exc:  # noqa: PERF203
            logger.warning("No se pudo renderizar una página del PDF: %s", exc)
            continue
        image.thumbnail((2200, 2200))
        images.append(image)
    return images


def _extract_pdf(data: bytes, filename: str, db: Session) -> Dict[str, Any]:
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover
        raise FileExtractionError("PyMuPDF no está instalado en el servidor.") from exc

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        logger.error("No se pudo abrir el PDF %s: %s", filename, exc, exc_info=True)
        raise FileExtractionError(f"No se pudo abrir el PDF: {exc}") from exc

    warnings: List[str] = []
    text_parts: List[str] = []
    try:
        for index, page in enumerate(doc):
            if index >= MAX_PDF_PAGES:
                warnings.append(f"El PDF tiene más de {MAX_PDF_PAGES} páginas; se procesaron las primeras.")
                break
            try:
                text_parts.append(page.get_text("text", sort=True))
            except TypeError:
                text_parts.append(page.get_text("text"))
    finally:
        pass

    text = "\n".join(text_parts).strip()
    source_type = "pdf"

    if len(text) < 50:
        images = _render_pdf_pages(doc, MAX_OCR_PAGES)
        if not images:
            doc.close()
            raise FileExtractionError("El PDF no tiene texto y no se pudieron renderizar sus páginas.")
        if len(doc) > MAX_OCR_PAGES:
            warnings.append(
                f"El PDF escaneado tiene {len(doc)} páginas; el OCR procesó las primeras {MAX_OCR_PAGES}."
            )
        text = ocr_images(images, db)
        source_type = "pdf_ocr"

    doc.close()
    text = text[:MAX_TEXT_CHARS]
    if not text.strip():
        raise FileExtractionError("No se pudo extraer texto del PDF.")
    return {
        "source_type": source_type,
        "items": [],
        "header": {},
        "text": text,
        "warnings": warnings,
    }


def _extract_image(data: bytes, filename: str, db: Session) -> Dict[str, Any]:
    try:
        image = Image.open(io.BytesIO(data))
        image = ImageOps.exif_transpose(image).convert("RGB")
    except Exception as exc:
        raise FileExtractionError(f"No se pudo abrir la imagen: {exc}") from exc

    image.thumbnail((2400, 2400))
    text = ocr_images([image], db)
    return {
        "source_type": "image",
        "items": [],
        "header": {},
        "text": text[:MAX_TEXT_CHARS],
        "warnings": [],
    }


def _extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def extract_from_file(data: bytes, filename: str, db: Session) -> Dict[str, Any]:
    """Extrae filas estructuradas o texto del archivo recibido."""
    extension = _extension(filename)
    if extension in EXCEL_EXTENSIONS:
        return _extract_excel(data, filename)
    if extension in CSV_EXTENSIONS:
        return _extract_csv(data, filename)
    if extension in PDF_EXTENSIONS:
        return _extract_pdf(data, filename, db)
    if extension in IMAGE_EXTENSIONS:
        return _extract_image(data, filename, db)
    raise UnsupportedFileTypeError(
        "Formato no soportado. Sube un archivo Excel (.xlsx), CSV, PDF o una imagen (JPG, PNG o WEBP)."
    )
