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
import shutil
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import openpyxl
from openpyxl.cell.cell import MergedCell
from openpyxl.styles import Alignment, Border, Font, Side
from openpyxl.worksheet.copier import WorksheetCopy

from inspector_bot.config import DATA_DIR
from inspector_bot.parser import format_engineer_name, resolve_single_inspector
from inspector_bot.project_store import (
    build_message_text_from_sheet_data,
    get_sheet_report,
    save_project_metadata,
    sync_sheet_reports_after_restructure,
    update_sheet_reports_dates,
)

logger = logging.getLogger(__name__)

SPANISH_DAYS: List[str] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

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

    # 2 & 3. Movimiento de Personal (A3:C6) y Personal de Inspección (A8:C10)
    personal = entry_data.get("personal", "")
    personal_inspeccion = entry_data.get("personal_inspeccion", "")

    if isinstance(personal_inspeccion, list):
        insp_parts = [p.strip() for p in personal_inspeccion if p.strip()]
    elif isinstance(personal_inspeccion, str) and personal_inspeccion.strip():
        insp_parts = [p.strip() for p in re.split(r"[\n,]+", personal_inspeccion) if p.strip()]
    else:
        insp_parts = []

    # Filtrar estrictamente cualquier Maestro de Obra o Caporal que se haya colado en inspección
    maestro_in_insp = [p for p in insp_parts if re.search(r"maestro(?:\s+de\s+obra)?", p, re.IGNORECASE)]
    real_inspectores = [p for p in insp_parts if not re.search(r"maestro|caporal", p, re.IGNORECASE)]
    insp_list = [format_engineer_name(p) for p in real_inspectores]
    personal_insp_str = "\n".join(insp_list) if insp_list else None

    # Si se detectó maestro en la lista de inspección y no está en personal de cuadrilla (A3), anexarlo a A3
    if maestro_in_insp and personal and not re.search(r"maestro", str(personal), re.IGNORECASE):
        clean_m_list = [re.sub(r"^Ing\.?\s*", "", m, flags=re.IGNORECASE).strip(" *.-") for m in maestro_in_insp]
        personal = f"{personal}, {', '.join(clean_m_list)}"

    safe_set_cell_value(
        ws_new,
        "A3",
        str(personal).strip() if personal else None,
        alignment=Alignment(wrap_text=True, horizontal="center", vertical="center"),
        font=Font(name="Calibri", size=8.5),
    )

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


def parse_date_string(date_str: str) -> datetime:
    """
    Parsea una cadena de texto a un objeto datetime.
    Soporta formato ISO (AAAA-MM-DD) y formato latino tradicional (DD/MM/AAAA o DD-MM-AAAA).
    Valida y genera ValueError temprano si el formato no es válido.
    """
    if not date_str or not str(date_str).strip():
        raise ValueError("La fecha no puede estar vacía.")

    clean_str = str(date_str).strip()

    # Formato ISO YYYY-MM-DD
    m_iso = re.search(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$", clean_str)
    if m_iso:
        y, mo, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        return datetime(y, mo, d)

    # Formato latino DD/MM/YYYY o DD-MM-YYYY
    m_lat = re.search(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$", clean_str)
    if m_lat:
        d, mo, y = int(m_lat.group(1)), int(m_lat.group(2)), int(m_lat.group(3))
        if y < 100:
            y += 2000
        return datetime(y, mo, d)

    raise ValueError(f"Formato de fecha inválido: '{date_str}'. Por favor usa DD/MM/AAAA (ej: 01/11/2026).")


def format_date_es(dt: datetime) -> str:
    """Formatea un objeto datetime en español indicando el día de la semana (ej: Lunes 26/10/2026)."""
    if not isinstance(dt, datetime):
        raise ValueError("El parámetro dt debe ser una instancia de datetime.")
    day_name = SPANISH_DAYS[dt.weekday()]
    return f"{day_name} {dt.strftime('%d/%m/%Y')}"


def count_workdays_between(start_dt: datetime, end_dt: datetime, valid_workdays: Set[int]) -> int:
    """
    Cuenta cuántos días hábiles transcurrieron entre start_dt (exclusivo) y end_dt (inclusivo)
    con base en el conjunto de días laborables válidos.
    """
    if end_dt <= start_dt:
        return 0
    cur = start_dt + timedelta(days=1)
    workdays = 0
    while cur <= end_dt:
        if cur.weekday() in valid_workdays:
            workdays += 1
        cur += timedelta(days=1)
    return workdays


def add_workdays(start_dt: datetime, num_workdays: int, valid_workdays: Set[int]) -> datetime:
    """Añade una cantidad de días hábiles a una fecha base respetando los días hábiles válidos."""
    if num_workdays < 0:
        raise ValueError("El número de días hábiles no puede ser negativo.")
    cur = start_dt
    added = 0
    while added < num_workdays:
        cur += timedelta(days=1)
        if cur.weekday() in valid_workdays:
            added += 1
    return cur


def calculate_start_date_shift_preview(project_name_or_filename: str, new_start_date_str: str) -> Dict[str, Any]:
    """
    Calcula la vista previa del desplazamiento secuencial de fechas del libro a partir
    de una nueva fecha de inicio para la Hoja 1, preservando los días hábiles y detectando
    saltos u omisiones de jornadas en el libro de obra.
    """
    if not project_name_or_filename or not project_name_or_filename.strip():
        raise ValueError("El nombre o archivo de proyecto no puede estar vacío.")

    # 1. Localizar archivo del libro
    book_path = find_existing_project_book(project_name_or_filename)
    if not book_path:
        direct_path = BOOKS_DIR / project_name_or_filename
        if direct_path.exists():
            book_path = direct_path
        else:
            raise FileNotFoundError(f"No se encontró el libro de obra para '{project_name_or_filename}'.")

    # 2. Cargar libro y recolectar hojas diarias
    wb = openpyxl.load_workbook(book_path, data_only=True)
    fixed_sheets = {"DATOS GENERALES", "ACTAS"}
    daily_sheets = [s for s in wb.sheetnames if s not in fixed_sheets]
    if not daily_sheets:
        raise ValueError("El libro de obra seleccionado no tiene hojas diarias asentadas.")

    sheet_dates: List[Tuple[str, datetime]] = []
    for s_name in daily_sheets:
        dt = get_sheet_date(wb[s_name])
        if dt != datetime.max:
            sheet_dates.append((s_name, dt))

    if not sheet_dates:
        raise ValueError("No se pudieron leer fechas válidas en las hojas diarias del libro.")

    # Ordenar por fecha cronológica para reconocer inequívocamente la primera hoja
    sheet_dates.sort(key=lambda item: item[1])
    first_sheet_name, old_start_date = sheet_dates[0]

    new_start_date = parse_date_string(new_start_date_str)
    if old_start_date == new_start_date:
        raise ValueError(
            f"La nueva fecha ({new_start_date_str}) es idéntica a la fecha actual de la Hoja {first_sheet_name}."
        )

    # 3. Determinar régimen laboral del libro (Lunes a Viernes por defecto; incluye fines de semana si ya existían)
    valid_workdays: Set[int] = {0, 1, 2, 3, 4}
    for _, dt in sheet_dates:
        if dt.weekday() in (5, 6):
            valid_workdays.add(dt.weekday())
    if new_start_date.weekday() in (5, 6):
        valid_workdays.add(new_start_date.weekday())

    # 4. Calcular el desplazamiento secuencial por días hábiles
    sheet_shifts: List[Dict[str, Any]] = []
    for s_name, old_dt in sheet_dates:
        workday_offset = count_workdays_between(old_start_date, old_dt, valid_workdays)
        new_dt = add_workdays(new_start_date, workday_offset, valid_workdays)
        sheet_shifts.append({
            "sheet_name": s_name,
            "old_date": old_dt,
            "new_date": new_dt,
            "workday_offset": workday_offset,
        })

    # 5. Detección robusta de saltos (gaps / jornadas laborales omitidas)
    gaps: List[Dict[str, Any]] = []
    for i in range(len(sheet_shifts) - 1):
        s_curr = sheet_shifts[i]
        s_next = sheet_shifts[i + 1]
        dt1 = s_curr["new_date"]
        dt2 = s_next["new_date"]
        if (dt2 - dt1).days > 1:
            missing_workdays: List[datetime] = []
            cur = dt1 + timedelta(days=1)
            while cur < dt2:
                if cur.weekday() in valid_workdays:
                    missing_workdays.append(cur)
                cur += timedelta(days=1)
            if missing_workdays:
                gaps.append({
                    "from_sheet": s_curr["sheet_name"],
                    "to_sheet": s_next["sheet_name"],
                    "from_date": dt1,
                    "to_date": dt2,
                    "missing_workdays": missing_workdays,
                })

    # Obtener nombre legible del proyecto
    gen_data = extract_general_data_from_workbook(wb)
    clean_project_name = gen_data.get("obra") or book_path.stem.replace("_Libro_de_Obra", "").replace("_", " ")

    return {
        "book_path": book_path,
        "book_filename": book_path.name,
        "project_name": clean_project_name,
        "first_sheet_name": first_sheet_name,
        "old_start_date": old_start_date,
        "new_start_date": new_start_date,
        "total_sheets": len(sheet_shifts),
        "sheet_shifts": sheet_shifts,
        "gaps": gaps,
        "valid_workdays": sorted(list(valid_workdays)),
    }


def apply_start_date_shift(
    project_name_or_filename: str,
    new_start_date_str: str,
    user_id: Optional[int] = None,
) -> Tuple[Path, Dict[str, Any]]:
    """
    Aplica de forma atómica y segura el cambio de fecha de inicio en el libro de obra Excel.
    Crea una copia de respaldo antes de modificar, actualiza las celdas G1 de todas las hojas,
    actualiza G21 en DATOS GENERALES, reordena las hojas y actualiza los metadatos en SQLite.
    """
    preview = calculate_start_date_shift_preview(project_name_or_filename, new_start_date_str)
    book_path: Path = preview["book_path"]

    # 1. Crear respaldo preventivo
    backups_dir = DATA_DIR / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = backups_dir / f"{book_path.stem}_backup_preshift_{timestamp_str}.xlsx"
    shutil.copy2(book_path, backup_file)
    logger.info("Respaldo creado con éxito en: %s", backup_file)

    # 2. Cargar libro con fórmulas preservadas (data_only=False)
    wb = openpyxl.load_workbook(book_path, data_only=False)

    # 3. Actualizar la celda G1 de cada hoja diaria con su nueva fecha proyectada
    for item in preview["sheet_shifts"]:
        s_name = item["sheet_name"]
        new_dt = item["new_date"]
        if s_name in wb.sheetnames:
            ws = wb[s_name]
            safe_set_cell_value(ws, "G1", f"FECHA: {new_dt.strftime('%d/%m/%Y')}")

    # 4. Actualizar fecha de inicio en DATOS GENERALES si existe
    new_start_formatted = preview["new_start_date"].strftime("%d/%m/%Y")
    if "DATOS GENERALES" in wb.sheetnames:
        safe_set_cell_value(wb["DATOS GENERALES"], "G21", new_start_formatted)

    # 5. Actualizar en ACTAS (F6: fecha de acta de inicio) si la hoja existe
    if "ACTAS" in wb.sheetnames:
        safe_set_cell_value(wb["ACTAS"], "F6", new_start_formatted)

    # 6. Reordenar cronológicamente y normalizar numeración
    sort_sheets_by_date(wb)
    wb.save(book_path)
    logger.info("Libro de Obra actualizado exitosamente con nueva fecha de inicio en: %s", book_path)

    # 7. Actualizar persistencia en SQLite
    try:
        project_name = preview["project_name"]
        save_project_metadata(project_name, user_id, {"fecha_inicio": new_start_formatted})
        shifts_data = [
            {
                "sheet_name": s["sheet_name"],
                "old_date_str": s["old_date"].strftime("%d/%m/%Y"),
                "new_date_str": s["new_date"].strftime("%d/%m/%Y"),
            }
            for s in preview["sheet_shifts"]
        ]
        update_sheet_reports_dates(project_name, shifts_data)
    except Exception as exc:
        logger.error("Error al actualizar SQLite para project_metadata/sheet_reports con nueva fecha: %s", exc, exc_info=True)

    return book_path, preview




def merge_daily_sheets(
    project_name_or_filename: str,
    sheet1_name: str,
    sheet2_name: str,
    target_date_str: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Tuple[Path, str, Dict[str, Any]]:
    """
    Fusiona dos hojas diarias contiguas en una sola hoja consolidada.
    Combina actividades, personal, maquinarias, observaciones y descripciones de labor.
    Escribe la información unificada en sheet1_name, elimina sheet2_name,
    y renumera correlativamente las hojas restantes (1, 2, ..., N-1).
    Actualiza la fecha de inicio en DATOS GENERALES y ACTAS si corresponde,
    y sincroniza de forma atómica la tabla sheet_reports en SQLite.
    """
    if not project_name_or_filename or not str(project_name_or_filename).strip():
        raise ValueError("El nombre del proyecto o archivo no puede estar vacío.")
    if not sheet1_name or not str(sheet1_name).strip():
        raise ValueError("sheet1_name no puede estar vacío.")
    if not sheet2_name or not str(sheet2_name).strip():
        raise ValueError("sheet2_name no puede estar vacío.")

    s1_str = str(sheet1_name).strip()
    s2_str = str(sheet2_name).strip()
    if s1_str == s2_str:
        raise ValueError("No se puede fusionar una hoja consigo misma.")

    # 1. Localizar libro
    book_path = find_existing_project_book(project_name_or_filename)
    if not book_path:
        direct_path = BOOKS_DIR / project_name_or_filename
        if direct_path.exists():
            book_path = direct_path
        else:
            raise FileNotFoundError(f"No se encontró el libro de obra para '{project_name_or_filename}'.")

    # 2. Respaldo preventivo
    backups_dir = DATA_DIR / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = backups_dir / f"{book_path.stem}_backup_premerge_{timestamp_str}.xlsx"
    shutil.copy2(book_path, backup_file)
    logger.info("Respaldo pre-fusión creado con éxito en: %s", backup_file)

    # 3. Cargar libro y verificar existencia de hojas
    wb = openpyxl.load_workbook(book_path, data_only=False)
    fixed_sheets = {"DATOS GENERALES", "ACTAS"}
    if s1_str not in wb.sheetnames:
        raise ValueError(f"La hoja '{s1_str}' no existe en el libro.")
    if s2_str not in wb.sheetnames:
        raise ValueError(f"La hoja '{s2_str}' no existe en el libro.")
    if s1_str in fixed_sheets or s2_str in fixed_sheets:
        raise ValueError("No se pueden fusionar las hojas fijas del sistema.")

    e1, g1, obra1 = load_sheet_entry_data(book_path, s1_str)
    e2, g2, obra2 = load_sheet_entry_data(book_path, s2_str)

    # 4. Determinar fecha objetivo unificada
    d1_str = str(e1.get("fecha") or "").strip()
    d2_str = str(e2.get("fecha") or "").strip()
    if target_date_str and target_date_str.strip():
        final_date = target_date_str.strip()
    else:
        final_date = d2_str if d2_str else d1_str

    # 5. Fusionar actividades deduplicadas preservando orden
    acts1 = e1.get("actividades_list") or []
    acts2 = e2.get("actividades_list") or []
    merged_acts: List[str] = []
    for a in acts1 + acts2:
        clean_act = a.strip()
        if clean_act and clean_act not in merged_acts:
            merged_acts.append(clean_act)
    merged_resumen = "\n".join(f"• {a}" for a in merged_acts)

    # 6. Fusionar maquinaria y equipo
    eq1 = str(e1.get("equipos") or "").strip()
    eq2 = str(e2.get("equipos") or "").strip()
    combined_eq_lines: List[str] = []
    for line in (eq1 + "\n" + eq2).splitlines():
        c_line = line.strip()
        if c_line and c_line not in combined_eq_lines:
            combined_eq_lines.append(c_line)
    merged_eq = "\n".join(combined_eq_lines)

    # 7. Fusionar observaciones
    obs1 = str(e1.get("observaciones") or "").strip()
    obs2 = str(e2.get("observaciones") or "").strip()
    valid_obs: List[str] = []
    for ob in [obs1, obs2]:
        if ob and ob.lower() not in ("sin observaciones", "sin observaciones particulares.", "sin observaciones."):
            for line in ob.splitlines():
                c_line = line.strip()
                if c_line and c_line not in valid_obs:
                    valid_obs.append(c_line)
    merged_obs = "\n".join(valid_obs) if valid_obs else "Sin observaciones particulares."

    # 8. Fusionar descripción de labor diaria
    desc1 = str(e1.get("descripcion_labor") or "").strip()
    desc2 = str(e2.get("descripcion_labor") or "").strip()
    if desc1 and desc2 and desc1 != desc2:
        merged_desc = f"{desc1}\n\n{desc2}"
    else:
        merged_desc = desc2 or desc1

    # 9. Personal de cuadrilla y de inspección
    pers1 = str(e1.get("personal") or "").strip()
    pers2 = str(e2.get("personal") or "").strip()
    if pers1 and pers2 and pers1 != pers2:
        merged_pers = pers2 if len(pers2) >= len(pers1) else pers1
    else:
        merged_pers = pers2 or pers1 or "Personal de cuadrilla en obra"

    insp1 = str(e1.get("personal_inspeccion") or "").strip()
    insp2 = str(e2.get("personal_inspeccion") or "").strip()
    merged_insp = insp2 or insp1

    # 10. Clima y Horas
    clima = e2.get("clima") or e1.get("clima") or "SOLEADO"
    horas = e2.get("horas_trabajadas") or e1.get("horas_trabajadas") or "8 HORAS"
    control_calidad = e2.get("control_calidad") or e1.get("control_calidad") or ""
    revisado_por = e2.get("revisado_por") or e1.get("revisado_por") or ""

    merged_entry: Dict[str, Any] = {
        "fecha": final_date,
        "clima": clima,
        "horas_trabajadas": horas,
        "personal": merged_pers,
        "personal_inspeccion": merged_insp,
        "equipos": merged_eq,
        "descripcion_labor": merged_desc,
        "actividades": merged_resumen,
        "resumen_actividades": merged_resumen,
        "actividades_list": merged_acts,
        "observaciones": merged_obs,
        "control_calidad": control_calidad,
        "revisado_por": revisado_por,
    }

    # 11. Escribir datos unificados en sheet1 y eliminar sheet2
    _fill_sheet_cells(wb[s1_str], merged_entry, final_date)
    wb.remove(wb[s2_str])

    # 12. Renumerar hojas correlativamente usando títulos temporales para evitar colisión
    daily_sheets = [s for s in wb.sheetnames if s not in fixed_sheets]
    for idx, s_name in enumerate(daily_sheets):
        wb[s_name].title = f"__temp_merge_{idx}__"

    for idx in range(len(daily_sheets)):
        wb[f"__temp_merge_{idx}__"].title = str(idx + 1)

    # 13. Actualizar fecha de inicio en DATOS GENERALES y ACTAS si se modificó la primera hoja
    new_first_sheet = wb["1"]
    raw_first_date = str(new_first_sheet["G1"].value or "").strip()
    new_first_date_val = re.sub(r"^FECHA:\s*", "", raw_first_date, flags=re.IGNORECASE).strip()
    if new_first_date_val:
        if "DATOS GENERALES" in wb.sheetnames:
            safe_set_cell_value(wb["DATOS GENERALES"], "G21", new_first_date_val)
        if "ACTAS" in wb.sheetnames:
            safe_set_cell_value(wb["ACTAS"], "F6", new_first_date_val)

    sort_sheets_by_date(wb)
    wb.save(book_path)
    logger.info("Fusión de hojas %s y %s completada exitosamente en %s", s1_str, s2_str, book_path)

    # 14. Sincronizar de forma atómica en SQLite (sheet_reports y project_metadata)
    general_data_for_reports = g1 or g2 or extract_general_data_from_workbook(wb)
    clean_project_name = general_data_for_reports.get("obra") or book_path.stem.replace("_Libro_de_Obra", "").replace("_", " ")

    try:
        updated_sheet_reports: List[Dict[str, str]] = []
        for idx in range(len(daily_sheets)):
            sheet_num_str = str(idx + 1)
            s_entry, s_gen, _ = load_sheet_entry_data(book_path, sheet_num_str)
            s_msg = build_message_text_from_sheet_data(s_entry, s_gen or general_data_for_reports)
            updated_sheet_reports.append({
                "sheet_name": sheet_num_str,
                "sheet_date": s_entry.get("fecha", ""),
                "message_text": s_msg,
            })

        sync_sheet_reports_after_restructure(clean_project_name, updated_sheet_reports)
        if new_first_date_val:
            save_project_metadata(clean_project_name, user_id, {"fecha_inicio": new_first_date_val})
    except Exception as exc:
        logger.error("Error al sincronizar SQLite tras fusión de hojas: %s", exc, exc_info=True)

    info: Dict[str, Any] = {
        "project_name": clean_project_name,
        "fused_sheets": (s1_str, s2_str),
        "target_date": final_date,
        "total_remaining_sheets": len(daily_sheets),
        "backup_path": backup_file,
    }
    return book_path, final_date, info
