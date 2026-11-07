"""
Módulo para la gestión del Libro de Obra en formato Excel compatible con Google Sheets.
Permite:
  1. Inicializar un nuevo libro de obra a partir de la plantilla estándar.
  2. Registrar o actualizar los datos del proyecto y profesionales en 'DATOS GENERALES'.
  3. Agregar una nueva hoja de reporte diario (con numeración incremental: 1, 2, 3...)
     manteniendo la vinculación dinámica a los datos del proyecto y firmas.
"""
import copy
import logging
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import openpyxl
from openpyxl.cell.cell import MergedCell
from openpyxl.styles import Alignment, Border, Font, Side
from openpyxl.worksheet.copier import WorksheetCopy

from libro_obra_bot.config import DATA_DIR
from libro_obra_bot.parser import format_engineer_name, resolve_single_inspector

logger = logging.getLogger(__name__)

THIN_SIDE = Side(border_style="thin", color="000000")
THIN_BORDER = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=THIN_SIDE)

TEMPLATE_PATH = DATA_DIR / "plantilla_libro_obra.xlsx"
BOOKS_DIR = DATA_DIR / "libros_de_obra"
BOOKS_DIR.mkdir(parents=True, exist_ok=True)


def sanitize_filename(name: str) -> str:
    """Genera un nombre seguro para el sistema de archivos."""
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    clean = re.sub(r"[^a-zA-Z0-9_\s-]", "", normalized)
    clean = re.sub(r"[\s-]+", "_", clean).strip("_")
    return clean[:80] if clean else "Libro_Obra"


def find_existing_project_book(project_name: str) -> Optional[Path]:
    """
    Busca si ya existe un archivo de libro de obra para el proyecto indicado.
    Asegura que si la obra es la misma no se generen archivos duplicados,
    sino que se reutilice el libro existente y se acumulen las hojas diarias.
    """
    if not project_name:
        return None

    safe_name = sanitize_filename(project_name)
    exact_path = BOOKS_DIR / f"{safe_name}_Libro_de_Obra.xlsx"
    if exact_path.exists():
        return exact_path

    existing_files = list(BOOKS_DIR.glob("*_Libro_de_Obra.xlsx"))
    if not existing_files:
        return None

    def _sanitize_for_compare(name: str) -> str:
        norm = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
        clean = re.sub(r"[^a-zA-Z0-9_]", "", clean_s if (clean_s := re.sub(r"[\s-]+", "_", norm)) else "")
        return clean.strip("_").upper()

    q_clean = _sanitize_for_compare(project_name)

    # 1. Búsqueda por prefijo común de longitud significativa (mínimo 25 caracteres)
    for file_path in existing_files:
        base_name = file_path.name.replace("_Libro_de_Obra.xlsx", "")
        f_clean = _sanitize_for_compare(base_name)
        if len(f_clean) >= 20 and (q_clean.startswith(f_clean) or f_clean.startswith(q_clean)):
            logger.info("Coincidencia por prefijo encontrada para '%s': %s", project_name, file_path.name)
            return file_path

    # 2. Búsqueda por palabras clave distintivas
    def _tokenize(text: str) -> set:
        norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
        tokens = set(re.findall(r"[a-z0-9]{3,}", norm))
        generic_words = {
            "del", "los", "las", "para", "por", "con", "una", "sin", "entre",
            "libro", "obra", "test", "prueba", "rehabilitacion", "construccion",
            "integral", "proyecto", "mantenimiento", "reparacion", "unidad",
        }
        return tokens - generic_words

    query_tokens = _tokenize(project_name)
    if not query_tokens:
        if len(existing_files) == 1:
            logger.info("Consulta sin palabras distintivas ('%s'). Reutilizando el único libro existente: %s", project_name, existing_files[0].name)
            return existing_files[0]
        return None

    best_file: Optional[Path] = None
    best_score = 0.0

    for file_path in existing_files:
        base_name = file_path.name.replace("_Libro_de_Obra.xlsx", "")
        file_tokens = _tokenize(base_name)
        common = query_tokens & file_tokens
        if common:
            # Requerir al menos 2 palabras clave coincidentes o 1 palabra muy distintiva (>= 6 letras)
            if len(common) >= 2 or any(len(w) >= 6 for w in common):
                jaccard = len(common) / len(query_tokens | file_tokens)
                score = (len(common) / max(len(file_tokens), 1)) + jaccard
                if score > best_score and score >= 0.4:
                    best_score = score
                    best_file = file_path

    if best_file:
        logger.info("Libro de obra existente reutilizado para '%s': %s (score=%.2f)", project_name, best_file.name, best_score)
        return best_file

    return None


def delete_project_book(project_name: str) -> bool:
    """
    Elimina físicamente el archivo Excel del libro de obra para el proyecto indicado.
    Retorna True si fue eliminado, False si no existía.
    """
    target_path = find_existing_project_book(project_name)
    if not target_path:
        safe_name = sanitize_filename(project_name)
        target_path = BOOKS_DIR / f"{safe_name}_Libro_de_Obra.xlsx"

    if target_path.exists():
        try:
            target_path.unlink()
            logger.info("Libro de obra eliminado: %s", target_path)
            return True
        except Exception as exc:
            logger.error("Error al eliminar libro de obra %s: %s", target_path, exc, exc_info=True)
            raise exc
    return False


def list_all_project_books() -> List[Dict[str, Any]]:
    """
    Lista todos los libros de obra existentes en el directorio BOOKS_DIR.
    Retorna una lista de diccionarios con metadatos del archivo y hojas.
    """
    books: List[Dict[str, Any]] = []
    if not BOOKS_DIR.exists():
        return books

    for file_path in sorted(BOOKS_DIR.glob("*_Libro_de_Obra.xlsx"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
            daily_sheets = [s for s in wb.sheetnames if s not in ["DATOS GENERALES", "ACTAS"]]
            sheet_count = len(daily_sheets)

            project_title = file_path.stem.replace("_Libro_de_Obra", "").replace("_", " ")
            if "DATOS GENERALES" in wb.sheetnames:
                try:
                    val_obra = str(wb["DATOS GENERALES"]["B4"].value or "").strip()
                    if val_obra:
                        project_title = val_obra
                except Exception as exc:
                    logger.error("Error leyendo nombre de obra en %s: %s", file_path.name, exc, exc_info=True)

            last_date = ""
            if daily_sheets:
                last_sheet = wb[daily_sheets[-1]]
                last_date_val = str(last_sheet["G1"].value or "").replace("FECHA:", "").strip()
                last_date = last_date_val

            books.append({
                "path": file_path,
                "filename": file_path.name,
                "project_name": project_title,
                "sheet_count": sheet_count,
                "sheets": daily_sheets,
                "last_date": last_date,
            })
        except Exception as exc:
            logger.error("Error al inspeccionar libro %s: %s", file_path.name, exc, exc_info=True)
            books.append({
                "path": file_path,
                "filename": file_path.name,
                "project_name": file_path.stem.replace("_Libro_de_Obra", "").replace("_", " "),
                "sheet_count": 0,
                "sheets": [],
                "last_date": "",
            })

    return books


def extract_general_data_from_workbook(wb: openpyxl.Workbook) -> Dict[str, Any]:
    """Extrae los metadatos de la hoja DATOS GENERALES si existe."""
    if not isinstance(wb, openpyxl.Workbook):
        raise ValueError("El parámetro wb debe ser una instancia válida de openpyxl.Workbook")
    data: Dict[str, Any] = {}
    if "DATOS GENERALES" not in wb.sheetnames:
        return data
    ws = wb["DATOS GENERALES"]
    fields = {
        "obra": "B4",
        "ente_contratante": "B7",
        "firma_contratista": "B10",
        "empresa_inspeccion": "B13",
        "objeto_contrato": "D15",
        "monto_contrato": "G17",
        "fecha_contrato": "G19",
        "fecha_inicio": "G21",
        "fecha_terminacion": "G23",
        "representante_legal": "D25",
        "civ_representante": "D26",
        "ing_residente": "D27",
        "civ_residente": "D28",
        "ing_inspector": "D29",
        "civ_inspector": "D30",
    }
    for k, cell in fields.items():
        val = str(ws[cell].value or "").strip()
        if val:
            data[k] = val
    return data


def is_workbook_outdated_layout(wb: openpyxl.Workbook) -> bool:
    """Verifica si el libro existente fue creado con el formato antiguo incompatible con Página 15."""
    if not isinstance(wb, openpyxl.Workbook):
        raise ValueError("El parámetro wb debe ser una instancia válida de openpyxl.Workbook")
    for s_name in wb.sheetnames:
        if s_name not in ["DATOS GENERALES", "ACTAS"]:
            ws = wb[s_name]
            if any(str(r) == "A2:C9" for r in ws.merged_cells.ranges):
                return True
            try:
                if isinstance(ws["A3"], MergedCell):
                    return True
            except Exception as exc:
                logger.error("Error verificando celda A3 en hoja %s: %s", s_name, exc, exc_info=True)
                return True
            if str(ws["A2"].value or "").strip() != "MOVIMIENTO DE PERSONAL":
                return True
            if (
                str(ws["D16"].value or "").strip() != "Resumen de Actividades por Partida"
                and str(ws["A16"].value or "").strip() != "Resumen de Actividades por Partida"
            ):
                return True
            if "Firma del Profesional Inspector" not in str(ws["G16"].value or ""):
                return True
            if any(str(r) == "G16:H16" for r in ws.merged_cells.ranges):
                return True
    return False


def safe_set_cell_value(
    ws: openpyxl.worksheet.worksheet.Worksheet,
    coord: str,
    value: Any,
    font: Optional[Font] = None,
    alignment: Optional[Alignment] = None,
) -> None:
    """Asigna el valor a una celda de manera segura, resolviendo a la celda principal si está dentro de un rango fusionado."""
    if not coord:
        raise ValueError("La coordenada de celda no puede estar vacía")
    cell = ws[coord]
    if isinstance(cell, MergedCell):
        for rng in ws.merged_cells.ranges:
            if coord in rng:
                cell = ws.cell(row=rng.min_row, column=rng.min_col)
                break
    cell.value = value
    if font:
        cell.font = font
    if alignment:
        cell.alignment = alignment


def get_or_create_project_book(project_name: str, general_data: Optional[Dict[str, Any]] = None) -> Tuple[Path, openpyxl.Workbook]:
    """
    Abre el libro de obra existente para el proyecto (o encuentra el coincidente si ya existe)
    o crea uno nuevo a partir de la plantilla si es la primera vez.
    Retorna la ruta del archivo y la instancia del Workbook.
    """
    if not project_name:
        raise ValueError("El nombre del proyecto no puede estar vacío.")

    existing_path = find_existing_project_book(project_name)
    if existing_path and existing_path.exists():
        book_path = existing_path
        wb = openpyxl.load_workbook(book_path)
        logger.info("Reutilizando libro de obra existente: %s", book_path)

        # Si el archivo existente tiene el layout antiguo incompatible, migrar a la nueva plantilla Página 15
        if is_workbook_outdated_layout(wb):
            logger.warning("El libro existente %s tiene un layout anterior. Actualizando a plantilla oficial Página 15...", book_path.name)
            extracted_general = extract_general_data_from_workbook(wb)
            if general_data:
                extracted_general.update(general_data)
            general_data = extracted_general

            # Recargar desde la plantilla oficial de Página 15
            wb = openpyxl.load_workbook(TEMPLATE_PATH)
            for extra in ["2", "3"]:
                if extra in wb.sheetnames:
                    del wb[extra]
            if "1" in wb.sheetnames:
                ws1 = wb["1"]
                safe_set_cell_value(ws1, "G1", "FECHA:")
                safe_set_cell_value(ws1, "A2", "MOVIMIENTO DE PERSONAL")
                safe_set_cell_value(ws1, "A3", None)
                safe_set_cell_value(ws1, "A7", "PERSONAL DE INSPECCIÓN")
                safe_set_cell_value(ws1, "A8", None)
                safe_set_cell_value(ws1, "A11", "MOVIMIENTO DE MAQUINARIA Y EQUIPO")
                safe_set_cell_value(ws1, "A12", None)
                safe_set_cell_value(ws1, "D2", "DESCRIPCIÓN DE LA LABOR DIARIA")
                safe_set_cell_value(ws1, "D3", None)
                safe_set_cell_value(ws1, "G2", "OBSERVACIONES")
                safe_set_cell_value(ws1, "G3", None)
                safe_set_cell_value(ws1, "G10", "Estado del Tiempo:")
                safe_set_cell_value(ws1, "H10", None)
                safe_set_cell_value(ws1, "G11", "Horas Trabajadas:")
                safe_set_cell_value(ws1, "H11", None)
                safe_set_cell_value(ws1, "G12", "Control de Calidad")
                safe_set_cell_value(ws1, "H12", "Revisado Por")
                safe_set_cell_value(ws1, "G13", None)
                safe_set_cell_value(ws1, "H13", None)

                for r in range(16, 22):
                    for rng_str in [f"A{r}:C{r}", f"D{r}:F{r}"]:
                        for rng in list(ws1.merged_cells.ranges):
                            if str(rng) == rng_str:
                                try:
                                    ws1.unmerge_cells(rng_str)
                                except Exception:
                                    pass
                    rng = f"A{r}:F{r}"
                    if not any(str(m) == rng for m in ws1.merged_cells.ranges):
                        ws1.merge_cells(rng)
                    for col in ["A", "B", "C", "D", "E", "F"]:
                        ws1[f"{col}{r}"].border = THIN_BORDER
                    safe_set_cell_value(ws1, f"A{r}", None)

                safe_set_cell_value(
                    ws1,
                    "A16",
                    "Resumen de Actividades por Partida",
                    font=Font(name="Calibri", size=9, bold=True),
                    alignment=Alignment(horizontal="center", vertical="center"),
                )

                for rng_str in ["G16:H16", "G19:H19"]:
                    if any(str(r) == rng_str for r in ws1.merged_cells.ranges):
                        try:
                            ws1.unmerge_cells(rng_str)
                        except Exception as exc:
                            logger.debug("No se pudo desfusionar %s: %s", rng_str, exc)

                safe_set_cell_value(ws1, "G16", "Firma del Profesional Inspector C.I.V No.", font=Font(name="Calibri", size=7.5, bold=True), alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"))
                safe_set_cell_value(ws1, "H16", "=IF('DATOS GENERALES'!D30=\"\",\"\",'DATOS GENERALES'!D30)", font=Font(name="Calibri", size=8.5, bold=True), alignment=Alignment(horizontal="center", vertical="center"))
                safe_set_cell_value(ws1, "G17", "=IF('DATOS GENERALES'!D29=\"\",\"\",'DATOS GENERALES'!D29)", font=Font(name="Calibri", size=8.5), alignment=Alignment(horizontal="center", vertical="center"))
                safe_set_cell_value(ws1, "G18", None)
                safe_set_cell_value(ws1, "G19", "Firma del Profesional Residente C.I.V No.", font=Font(name="Calibri", size=7.5, bold=True), alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"))
                safe_set_cell_value(ws1, "H19", "=IF('DATOS GENERALES'!D28=\"\",\"\",'DATOS GENERALES'!D28)", font=Font(name="Calibri", size=8.5, bold=True), alignment=Alignment(horizontal="center", vertical="center"))
                safe_set_cell_value(ws1, "G20", "=IF('DATOS GENERALES'!D27=\"\",\"\",'DATOS GENERALES'!D27)", font=Font(name="Calibri", size=8.5), alignment=Alignment(horizontal="center", vertical="center"))
                safe_set_cell_value(ws1, "G21", None)
            wb.save(book_path)
    else:
        safe_name = sanitize_filename(project_name)
        book_path = BOOKS_DIR / f"{safe_name}_Libro_de_Obra.xlsx"
        if not TEMPLATE_PATH.exists():
            raise FileNotFoundError(f"No se encontró la plantilla en {TEMPLATE_PATH}")
        wb = openpyxl.load_workbook(TEMPLATE_PATH)

        # Si la plantilla traía hojas de prueba '2' y '3', eliminarlas para iniciar limpio con '1'
        for extra_sheet in ["2", "3"]:
            if extra_sheet in wb.sheetnames:
                del wb[extra_sheet]

        # Limpiar hoja '1' para dejarla como plantilla virgen conforme a Página 15 (Control Diario de Obra)
        if "1" in wb.sheetnames:
            ws1 = wb["1"]
            safe_set_cell_value(ws1, "G1", "FECHA:")
            safe_set_cell_value(ws1, "A2", "MOVIMIENTO DE PERSONAL")
            safe_set_cell_value(ws1, "A3", None)
            safe_set_cell_value(ws1, "A7", "PERSONAL DE INSPECCIÓN")
            safe_set_cell_value(ws1, "A8", None)
            safe_set_cell_value(ws1, "A11", "MOVIMIENTO DE MAQUINARIA Y EQUIPO")
            safe_set_cell_value(ws1, "A12", None)
            safe_set_cell_value(ws1, "D2", "DESCRIPCIÓN DE LA LABOR DIARIA")
            safe_set_cell_value(ws1, "D3", None)
            safe_set_cell_value(ws1, "G2", "OBSERVACIONES")
            safe_set_cell_value(ws1, "G3", None)
            safe_set_cell_value(ws1, "G10", "Estado del Tiempo:")
            safe_set_cell_value(ws1, "H10", None)
            safe_set_cell_value(ws1, "G11", "Horas Trabajadas:")
            safe_set_cell_value(ws1, "H11", None)
            safe_set_cell_value(ws1, "G12", "Control de Calidad")
            safe_set_cell_value(ws1, "H12", "Revisado Por")
            safe_set_cell_value(ws1, "G13", None)
            safe_set_cell_value(ws1, "H13", None)

            for r in range(16, 22):
                for rng_str in [f"A{r}:C{r}", f"D{r}:F{r}"]:
                    for rng in list(ws1.merged_cells.ranges):
                        if str(rng) == rng_str:
                            try:
                                ws1.unmerge_cells(rng_str)
                            except Exception:
                                pass
                rng = f"A{r}:F{r}"
                if not any(str(m) == rng for m in ws1.merged_cells.ranges):
                    ws1.merge_cells(rng)
                for col in ["A", "B", "C", "D", "E", "F"]:
                    ws1[f"{col}{r}"].border = THIN_BORDER
                safe_set_cell_value(ws1, f"A{r}", None)

            safe_set_cell_value(
                ws1,
                "A16",
                "Resumen de Actividades por Partida",
                font=Font(name="Calibri", size=9, bold=True),
                alignment=Alignment(horizontal="center", vertical="center"),
            )

            for rng_str in ["G16:H16", "G19:H19"]:
                if any(str(r) == rng_str for r in ws1.merged_cells.ranges):
                    try:
                        ws1.unmerge_cells(rng_str)
                    except Exception as exc:
                        logger.debug("No se pudo desfusionar %s: %s", rng_str, exc)

            safe_set_cell_value(ws1, "G16", "Firma del Profesional Inspector C.I.V No.", font=Font(name="Calibri", size=7.5, bold=True), alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"))
            safe_set_cell_value(ws1, "H16", "=IF('DATOS GENERALES'!D30=\"\",\"\",'DATOS GENERALES'!D30)", font=Font(name="Calibri", size=8.5, bold=True), alignment=Alignment(horizontal="center", vertical="center"))
            safe_set_cell_value(ws1, "G17", "=IF('DATOS GENERALES'!D29=\"\",\"\",'DATOS GENERALES'!D29)", font=Font(name="Calibri", size=8.5), alignment=Alignment(horizontal="center", vertical="center"))
            safe_set_cell_value(ws1, "G18", None)
            safe_set_cell_value(ws1, "G19", "Firma del Profesional Residente C.I.V No.", font=Font(name="Calibri", size=7.5, bold=True), alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"))
            safe_set_cell_value(ws1, "H19", "=IF('DATOS GENERALES'!D28=\"\",\"\",'DATOS GENERALES'!D28)", font=Font(name="Calibri", size=8.5, bold=True), alignment=Alignment(horizontal="center", vertical="center"))
            safe_set_cell_value(ws1, "G20", "=IF('DATOS GENERALES'!D27=\"\",\"\",'DATOS GENERALES'!D27)", font=Font(name="Calibri", size=8.5), alignment=Alignment(horizontal="center", vertical="center"))
            safe_set_cell_value(ws1, "G21", None)

        wb.save(book_path)

    if general_data:
        update_general_data(wb, general_data)
        wb.save(book_path)

    return book_path, wb


def update_general_data(wb: openpyxl.Workbook, data: Dict[str, Any]) -> None:
    """
    Actualiza la hoja 'DATOS GENERALES' con la información del contrato y profesionales.
    Todas las hojas diarias se alimentan automáticamente de estos campos.
    """
    if "DATOS GENERALES" not in wb.sheetnames:
        logger.warning("No se encontró la hoja 'DATOS GENERALES' en el libro.")
        return

    ws = wb["DATOS GENERALES"]

    if data.get("obra"):
        ws["B4"].value = str(data["obra"]).strip()
    if data.get("ente_contratante"):
        ws["B7"].value = str(data["ente_contratante"]).strip()
    if data.get("firma_contratista"):
        ws["B10"].value = str(data["firma_contratista"]).strip()
    if data.get("empresa_inspeccion"):
        ws["B13"].value = str(data["empresa_inspeccion"]).strip()
    if data.get("objeto_contrato"):
        ws["D15"].value = f"CONTRATO Nº {data['objeto_contrato']}" if not str(data["objeto_contrato"]).startswith("CONTRATO") else str(data["objeto_contrato"])
    if data.get("monto_contrato"):
        ws["G17"].value = str(data["monto_contrato"]).strip()
    if data.get("fecha_contrato"):
        ws["G19"].value = str(data["fecha_contrato"]).strip()
    if data.get("fecha_inicio"):
        ws["G21"].value = str(data["fecha_inicio"]).strip()
    if data.get("fecha_terminacion"):
        ws["G23"].value = str(data["fecha_terminacion"]).strip()

    # Profesionales y firmas
    if data.get("representante_legal"):
        ws["D25"].value = str(data["representante_legal"]).strip()
    if data.get("civ_representante"):
        civ = str(data["civ_representante"]).strip()
        ws["D26"].value = f"C.I.V. {civ}" if not civ.upper().startswith("C.I.V") else civ
    if data.get("ing_residente"):
        ws["D27"].value = format_engineer_name(str(data["ing_residente"]).strip())
    if data.get("civ_residente"):
        civ = str(data["civ_residente"]).strip()
        ws["D28"].value = f"C.I.V. {civ}" if not civ.upper().startswith("C.I.V") else civ
    if data.get("ing_inspector"):
        insp = str(data["ing_inspector"]).strip()
        ws["D29"].value = resolve_single_inspector([p.strip() for p in insp.split(",")])
    if data.get("civ_inspector"):
        civ = str(data["civ_inspector"]).strip()
        ws["D30"].value = f"C.I.V. {civ}" if not civ.upper().startswith("C.I.V") else civ


def get_sheet_date(ws: openpyxl.worksheet.worksheet.Worksheet) -> datetime:
    """Extrae la fecha de la celda G1 de una hoja diaria para su ordenación cronológica."""
    val_str = str(ws["G1"].value or "").strip()
    # Buscar formato ISO YYYY-MM-DD
    m_iso = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", val_str)
    if m_iso:
        return datetime(int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3)))
    # Buscar formato latino DD/MM/YYYY
    m = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})", val_str)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000
        return datetime(y, mo, d)
    return datetime.max


def sort_sheets_by_date(wb: openpyxl.Workbook) -> None:
    """
    Reordena las hojas del libro cronológicamente de izquierda a derecha
    (la fecha más antigua primero: 1, 2, 3...) manteniendo 'DATOS GENERALES' y 'ACTAS' al inicio.
    """
    fixed_sheets = [s for s in wb.sheetnames if s in ["DATOS GENERALES", "ACTAS"]]
    daily_sheets = [s for s in wb.sheetnames if s not in fixed_sheets]

    if not daily_sheets:
        return

    # Ordenar las hojas diarias por la fecha real de G1
    sorted_daily = sorted(daily_sheets, key=lambda s: get_sheet_date(wb[s]))

    # Renombrar temporalmente para evitar colisiones de nombres de hojas
    for idx, s in enumerate(sorted_daily, start=1):
        wb[s].title = f"__temp_daily_{idx}__"

    new_order = fixed_sheets.copy()
    for idx in range(1, len(sorted_daily) + 1):
        temp_name = f"__temp_daily_{idx}__"
        final_name = str(idx)
        wb[temp_name].title = final_name
        new_order.append(final_name)

    # Reordenar físicamente la lista interna de worksheets
    wb._sheets = [wb[s] for s in new_order]


def get_next_sheet_number(wb: openpyxl.Workbook) -> int:
    """Calcula el número correlativo para la siguiente hoja diaria de obra."""
    sheet_numbers = []
    for name in wb.sheetnames:
        if name.isdigit():
            sheet_numbers.append(int(name))
    return (max(sheet_numbers) + 1) if sheet_numbers else 1


def add_daily_entry_to_book(
    project_name: str,
    entry_data: Dict[str, Any],
    general_data: Optional[Dict[str, Any]] = None,
) -> Tuple[Path, str, int]:
    """
    Agrega una nueva hoja al libro de obra del proyecto con los datos del día.
    Retorna (ruta_archivo, nombre_hoja, numero_hoja).
    """
    book_path, wb = get_or_create_project_book(project_name, general_data)

    fecha_val = entry_data.get("fecha") or datetime.now().strftime("%d/%m/%Y")

    # 1. Comprobar si esta fecha ya fue registrada previamente en alguna hoja existente para actualizarla
    target_ws: Optional[openpyxl.worksheet.worksheet.Worksheet] = None
    target_sheet_name: str = ""

    for s_name in wb.sheetnames:
        if s_name not in ["DATOS GENERALES", "ACTAS"]:
            val_g1 = str(wb[s_name]["G1"].value or "").strip()
            if fecha_val in val_g1:
                target_ws = wb[s_name]
                target_sheet_name = s_name
                break

    if target_ws is not None:
        # Se actualiza la hoja del mismo día en lugar de duplicar hojas
        ws_new = target_ws
        sheet_name = target_sheet_name
        logger.info("Actualizando hoja existente '%s' para la fecha %s en %s", sheet_name, fecha_val, book_path.name)
    elif "1" in wb.sheetnames and (wb["1"]["G1"].value in [None, "FECHA:", "FECHA"]):
        # Si la hoja '1' existe y no tiene fecha registrada o es virgen, se usa directamente como el primer día
        ws_new = wb["1"]
        sheet_name = "1"
        logger.info("Usando hoja virgen '1' para la fecha %s en %s", fecha_val, book_path.name)
    else:
        # Fecha nueva en la misma obra: agregar correlativo (2, 3, 4...) manteniendo todas en el mismo archivo
        sheet_num = get_next_sheet_number(wb)
        sheet_name = str(sheet_num)
        
        # Usamos la hoja 1 o la última numérica como molde base
        base_sheet_name = "1" if "1" in wb.sheetnames else [s for s in wb.sheetnames if s.isdigit()][-1]
        source_ws = wb[base_sheet_name]
        
        ws_new = wb.copy_worksheet(source_ws)
        ws_new.title = sheet_name
        logger.info("Agregando nueva hoja diaria '%s' a la obra en %s", sheet_name, book_path.name)

    # Llenar datos del día en ws_new conforme al layout de Página 15 (Control Diario de Obra)
    _fill_sheet_cells(ws_new, entry_data, fecha_val)

    # 10. Reordenar cronológicamente todas las hojas diarias por fecha (la más antigua a la izquierda)
    sort_sheets_by_date(wb)

    wb.save(book_path)

    # Determinar el nombre final de la hoja que acabamos de guardar
    target_date = get_sheet_date(ws_new)
    final_sheet_name = sheet_name
    for s_name in wb.sheetnames:
        if s_name not in ["DATOS GENERALES", "ACTAS"] and get_sheet_date(wb[s_name]) == target_date:
            final_sheet_name = s_name
            break

    logger.info(f"Hoja '{final_sheet_name}' registrada y ordenada exitosamente en {book_path}")
    return book_path, final_sheet_name, int(final_sheet_name) if final_sheet_name.isdigit() else 1


def _fill_sheet_cells(ws_new: Any, entry_data: Dict[str, Any], fecha_val: str) -> None:
    """Rellena y formatea las celdas de una hoja conforme al layout oficial de Página 15 (CIV)."""
    # 1. Fecha (Cabecera G1:H1)
    safe_set_cell_value(ws_new, "G1", f"FECHA: {fecha_val}")

    # 2. Movimiento de Personal (A3:C6)
    personal = entry_data.get("personal", "")
    safe_set_cell_value(
        ws_new,
        "A3",
        str(personal).strip() if personal else None,
        alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"),
        font=Font(name="Calibri", size=8.5),
    )

    # 3. Personal de Inspección (A8:C10)
    personal_inspeccion = entry_data.get("personal_inspeccion", "")
    if isinstance(personal_inspeccion, list):
        insp_list = [format_engineer_name(p.strip()) for p in personal_inspeccion if p.strip()]
        personal_insp_str = "\n".join(insp_list)
    elif isinstance(personal_inspeccion, str) and personal_inspeccion.strip():
        parts = [p.strip() for p in re.split(r"[\n,]+", personal_inspeccion) if p.strip()]
        insp_list = [format_engineer_name(p) for p in parts]
        personal_insp_str = "\n".join(insp_list)
    else:
        personal_insp_str = None

    safe_set_cell_value(
        ws_new,
        "A8",
        personal_insp_str,
        alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"),
        font=Font(name="Calibri", size=8.5),
    )

    # 4. Movimiento de Maquinaria y Equipo (A12:C15)
    equipos = entry_data.get("equipos", "")
    safe_set_cell_value(
        ws_new,
        "A12",
        str(equipos).strip() if equipos else None,
        alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"),
        font=Font(name="Calibri", size=8.5),
    )

    # 5. Descripción de la labor diaria (D3:F15)
    descripcion_labor = entry_data.get("descripcion_labor") or entry_data.get("actividades", "")
    safe_set_cell_value(
        ws_new,
        "D3",
        str(descripcion_labor).strip() if descripcion_labor else None,
        font=Font(name="Calibri", size=9),
        alignment=Alignment(wrap_text=True, horizontal="left", vertical="top"),
    )

    # 6. Observaciones (G3:H9)
    observaciones = entry_data.get("observaciones", "")
    safe_set_cell_value(
        ws_new,
        "G3",
        str(observaciones).strip() if observaciones else None,
        font=Font(name="Calibri", size=9),
        alignment=Alignment(wrap_text=True, horizontal="left", vertical="top"),
    )

    # 7. Estado del tiempo (G10: etiqueta, H10: valor con ajuste automático de texto)
    clima = entry_data.get("clima") or "SOLEADO"
    clima_str = str(clima).strip().upper()
    font_size_clima = 7.5 if len(clima_str) > 20 else 9
    safe_set_cell_value(
        ws_new,
        "G10",
        "Estado del Tiempo:",
        font=Font(name="Calibri", size=8.5, bold=True),
        alignment=Alignment(horizontal="left", vertical="center"),
    )
    safe_set_cell_value(
        ws_new,
        "H10",
        clima_str,
        font=Font(name="Calibri", size=font_size_clima),
        alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"),
    )
    if len(clima_str) > 25:
        ws_new.row_dimensions[10].height = max(ws_new.row_dimensions[10].height or 20, 36.0)

    # 8. Horas trabajadas (G11: etiqueta, H11: valor)
    horas = entry_data.get("horas_trabajadas") or "8 HORAS"
    safe_set_cell_value(ws_new, "G11", "Horas Trabajadas:", font=Font(name="Calibri", size=8.5, bold=True), alignment=Alignment(horizontal="left", vertical="center"))
    safe_set_cell_value(ws_new, "H11", str(horas).strip(), font=Font(name="Calibri", size=9), alignment=Alignment(horizontal="center", vertical="center"))

    # 9. Control de Calidad y Revisado Por (G12 y H12 encabezados; G13:G15 y H13:H15 contenido)
    safe_set_cell_value(ws_new, "G12", "Control de Calidad", font=Font(name="Calibri", size=8.5, bold=True), alignment=Alignment(horizontal="center", vertical="center"))
    control_calidad = entry_data.get("control_calidad", "").strip()
    safe_set_cell_value(
        ws_new,
        "G13",
        control_calidad if control_calidad else None,
        alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"),
        font=Font(name="Calibri", size=8.5),
    )

    safe_set_cell_value(ws_new, "H12", "Revisado Por", font=Font(name="Calibri", size=8.5, bold=True), alignment=Alignment(horizontal="center", vertical="center"))
    revisado_por = entry_data.get("revisado_por", "").strip()
    safe_set_cell_value(
        ws_new,
        "H13",
        revisado_por if revisado_por else None,
        alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"),
        font=Font(name="Calibri", size=8.5),
    )

    # 10. Resumen de Actividades por Partida (A16:F16 encabezado centrado, A17:F17 a A21:F21 filas de partidas)
    for r in range(16, 22):
        for rng_str in [f"A{r}:C{r}", f"D{r}:F{r}"]:
            for rng in list(ws_new.merged_cells.ranges):
                if str(rng) == rng_str:
                    try:
                        ws_new.unmerge_cells(rng_str)
                    except Exception:
                        pass
        rng = f"A{r}:F{r}"
        if not any(str(m) == rng for m in ws_new.merged_cells.ranges):
            ws_new.merge_cells(rng)
        for col in ["A", "B", "C", "D", "E", "F"]:
            ws_new[f"{col}{r}"].border = THIN_BORDER

    safe_set_cell_value(
        ws_new,
        "A16",
        "Resumen de Actividades por Partida",
        font=Font(name="Calibri", size=9, bold=True),
        alignment=Alignment(horizontal="center", vertical="center"),
    )
    actividades_list = entry_data.get("actividades_list")
    if not actividades_list:
        raw_resumen = entry_data.get("resumen_actividades", "")
        if raw_resumen:
            actividades_list = [
                line.strip().lstrip("•-* ").strip()
                for line in raw_resumen.split("\n")
                if line.strip().lstrip("•-* ").strip()
            ]
        else:
            actividades_list = []

    for r_idx in range(17, 22):
        coord = f"A{r_idx}"
        act_idx = r_idx - 17
        if act_idx < len(actividades_list):
            if act_idx == 4 and len(actividades_list) > 5:
                val_text = "• " + " • ".join(actividades_list[4:])
            else:
                val_text = f"• {actividades_list[act_idx]}"
            safe_set_cell_value(
                ws_new,
                coord,
                val_text,
                font=Font(name="Calibri", size=8.5),
                alignment=Alignment(wrap_text=True, horizontal="left", vertical="center"),
            )
        else:
            safe_set_cell_value(ws_new, coord, None)

    # 11. Firma del Profesional Inspector C.I.V No. (G16 encabezado, H16 CIV No. al lado, G17:H17 Nombre, G18:H18 Espacio Firma)
    for rng_str in ["G16:H16", "G19:H19"]:
        if any(str(r) == rng_str for r in ws_new.merged_cells.ranges):
            try:
                ws_new.unmerge_cells(rng_str)
            except Exception as exc:
                logger.debug("No se pudo desfusionar %s: %s", rng_str, exc)

    safe_set_cell_value(
        ws_new,
        "G16",
        "Firma del Profesional Inspector C.I.V No.",
        font=Font(name="Calibri", size=7.5, bold=True),
        alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"),
    )
    safe_set_cell_value(
        ws_new,
        "H16",
        "=IF('DATOS GENERALES'!D30=\"\",\"\",'DATOS GENERALES'!D30)",
        font=Font(name="Calibri", size=8.5, bold=True),
        alignment=Alignment(horizontal="center", vertical="center"),
    )
    safe_set_cell_value(
        ws_new,
        "G17",
        "=IF('DATOS GENERALES'!D29=\"\",\"\",'DATOS GENERALES'!D29)",
        font=Font(name="Calibri", size=8.5),
        alignment=Alignment(horizontal="center", vertical="center"),
    )
    safe_set_cell_value(ws_new, "G18", None)

    # 12. Firma del Profesional Residente C.I.V No. (G19 encabezado, H19 CIV No. al lado, G20:H20 Nombre, G21:H21 Espacio Firma)
    safe_set_cell_value(
        ws_new,
        "G19",
        "Firma del Profesional Residente C.I.V No.",
        font=Font(name="Calibri", size=7.5, bold=True),
        alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"),
    )
    safe_set_cell_value(
        ws_new,
        "H19",
        "=IF('DATOS GENERALES'!D28=\"\",\"\",'DATOS GENERALES'!D28)",
        font=Font(name="Calibri", size=8.5, bold=True),
        alignment=Alignment(horizontal="center", vertical="center"),
    )
    safe_set_cell_value(
        ws_new,
        "G20",
        "=IF('DATOS GENERALES'!D27=\"\",\"\",'DATOS GENERALES'!D27)",
        font=Font(name="Calibri", size=8.5),
        alignment=Alignment(horizontal="center", vertical="center"),
    )
    safe_set_cell_value(ws_new, "G21", None)


def update_saved_sheet(
    obra: str,
    sheet_name: str,
    entry_data: Dict[str, Any],
    general_data: Optional[Dict[str, Any]] = None,
) -> Tuple[Path, str]:
    """
    Actualiza el contenido de una hoja existente en el Libro de Obra oficial del proyecto,
    sin crear una nueva hoja, y guarda el archivo Excel ordenado cronológicamente.
    """
    if not obra:
        raise ValueError("El nombre de la obra es obligatorio para actualizar el libro.")
    book_path = find_existing_project_book(obra)
    if not book_path:
        raise FileNotFoundError(f"No se encontró un Libro de Obra guardado para la obra: {obra}")

    wb = openpyxl.load_workbook(book_path)

    if general_data and "DATOS GENERALES" in wb.sheetnames:
        update_general_data(wb, general_data)

    if sheet_name not in wb.sheetnames:
        raise ValueError(f"La hoja '{sheet_name}' no existe en el libro {book_path.name}")

    ws = wb[sheet_name]
    fecha_val = entry_data.get("fecha") or datetime.now().strftime("%d/%m/%Y")
    _fill_sheet_cells(ws, entry_data, fecha_val)

    sort_sheets_by_date(wb)
    wb.save(book_path)
    logger.info("Hoja '%s' actualizada con éxito en %s", sheet_name, book_path.name)
    return book_path, sheet_name


def list_book_sheets(book_path: Union[str, Path]) -> List[Dict[str, str]]:
    """
    Lista las hojas diarias disponibles en un Libro de Obra con su fecha y descripción.
    Retorna [{'sheet_name': '1', 'fecha': '22/10/2026', 'resumen': '...'}, ...]
    """
    p = Path(book_path)
    if not p.exists():
        return []

    wb = openpyxl.load_workbook(p, data_only=True)
    sheets_info: List[Dict[str, str]] = []
    for s_name in wb.sheetnames:
        if s_name in ["DATOS GENERALES", "ACTAS"]:
            continue
        ws = wb[s_name]
        raw_fecha = str(ws["G1"].value or "").strip()
        fecha_clean = re.sub(r"^FECHA:\s*", "", raw_fecha, flags=re.IGNORECASE).strip()
        desc = str(ws["D3"].value or "").strip()
        sheets_info.append({
            "sheet_name": s_name,
            "fecha": fecha_clean or "Sin fecha",
            "resumen": (desc[:50] + "...") if len(desc) > 50 else desc,
        })
    return sheets_info


def load_sheet_entry_data(book_path: Union[str, Path], sheet_name: str) -> Tuple[Dict[str, Any], Dict[str, Any], str]:
    """
    Carga los datos de una hoja existente de un Libro de Obra para permitir su edición.
    Retorna (entry_data, general_data, obra).
    """
    p = Path(book_path)
    if not p.exists():
        raise FileNotFoundError(f"No existe el archivo {p}")

    wb = openpyxl.load_workbook(p, data_only=False)
    if sheet_name not in wb.sheetnames:
        raise ValueError(f"La hoja '{sheet_name}' no existe en el libro {p.name}")

    general_data: Dict[str, Any] = {}
    obra = ""
    if "DATOS GENERALES" in wb.sheetnames:
        ws_gen = wb["DATOS GENERALES"]
        obra = str(ws_gen["D18"].value or "").strip()
        general_data["obra"] = obra
        general_data["empresa"] = str(ws_gen["D19"].value or "").strip()
        general_data["ubicacion"] = str(ws_gen["D20"].value or "").strip()
        general_data["ente_contratante"] = str(ws_gen["D21"].value or "").strip()
        general_data["contrato_numero"] = str(ws_gen["D22"].value or "").strip()
        general_data["contrato_fecha"] = str(ws_gen["D23"].value or "").strip()
        general_data["monto_contrato"] = str(ws_gen["D24"].value or "").strip()
        general_data["plazo_ejecucion"] = str(ws_gen["D25"].value or "").strip()
        general_data["fecha_inicio"] = str(ws_gen["D26"].value or "").strip()
        ing_res = str(ws_gen["D27"].value or "").strip()
        civ_res_raw = str(ws_gen["D28"].value or "").strip()
        civ_res = re.sub(r"^(?:C\.?I\.?V\.?|CIV|N[ºo°]?\.?)\s*", "", civ_res_raw, flags=re.IGNORECASE).strip()

        ing_insp = str(ws_gen["D29"].value or "").strip()
        civ_insp_raw = str(ws_gen["D30"].value or "").strip()
        civ_insp = re.sub(r"^(?:C\.?I\.?V\.?|CIV|N[ºo°]?\.?)\s*", "", civ_insp_raw, flags=re.IGNORECASE).strip()

        general_data["ingeniero_residente"] = ing_res
        general_data["ing_residente"] = ing_res
        general_data["civ_residente"] = civ_res
        general_data["ingeniero_inspector"] = ing_insp
        general_data["ing_inspector"] = ing_insp
        general_data["civ_inspector"] = civ_insp

    ws = wb[sheet_name]

    raw_fecha = str(ws["G1"].value or "").strip()
    fecha = re.sub(r"^FECHA:\s*", "", raw_fecha, flags=re.IGNORECASE).strip()

    personal = str(ws["A3"].value or "").strip()
    personal_inspeccion = str(ws["A8"].value or "").strip()
    equipos = str(ws["A12"].value or "").strip()
    descripcion_labor = str(ws["D3"].value or "").strip()
    observaciones = str(ws["G3"].value or "").strip()
    clima = str(ws["H10"].value or "").strip()
    horas = str(ws["H11"].value or "").strip()
    control_calidad = str(ws["G13"].value or "").strip()
    revisado_por = str(ws["H13"].value or "").strip()

    actividades_list: List[str] = []
    for r in range(17, 22):
        val = str(ws[f"A{r}"].value or "").strip()
        if val:
            clean_val = val.lstrip("•-* ").strip()
            if clean_val:
                actividades_list.append(clean_val)

    resumen_act = "\n".join(f"• {a}" for a in actividades_list)

    entry_data: Dict[str, Any] = {
        "fecha": fecha,
        "personal": personal,
        "personal_inspeccion": personal_inspeccion,
        "equipos": equipos,
        "descripcion_labor": descripcion_labor,
        "observaciones": observaciones,
        "clima": clima,
        "horas_trabajadas": horas,
        "control_calidad": control_calidad,
        "revisado_por": revisado_por,
        "actividades_list": actividades_list,
        "actividades": resumen_act,
        "resumen_actividades": resumen_act,
    }

    return entry_data, general_data, obra
