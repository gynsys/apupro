"""
Gestor de persistencia en SQLite / JSON para proyectos y configuración de Libros de Obra.
Permite recordar los datos generales de la obra (residente, inspector, contratista, CIV, etc.)
por usuario o por proyecto para no tener que solicitarlos repetidamente.
"""
import json
import logging
import re
import sqlite3
import unicodedata
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Set

from libro_obra_bot.config import DATA_DIR

logger = logging.getLogger(__name__)

DB_PATH = DATA_DIR / "inspector_bot.db"


@contextmanager
def _get_connection() -> Iterator[sqlite3.Connection]:
    """Administrador de contexto seguro para conexiones SQLite."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Crea las tablas necesarias si no existen."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS project_metadata (
                project_id TEXT PRIMARY KEY,
                user_id INTEGER,
                obra TEXT,
                ente_contratante TEXT,
                firma_contratista TEXT,
                empresa_inspeccion TEXT,
                objeto_contrato TEXT,
                monto_contrato TEXT,
                fecha_contrato TEXT,
                fecha_inicio TEXT,
                fecha_terminacion TEXT,
                representante_legal TEXT,
                civ_representante TEXT,
                ing_residente TEXT,
                civ_residente TEXT,
                ing_inspector TEXT,
                civ_inspector TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_inspections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT,
                user_id INTEGER,
                fecha TEXT,
                report_data TEXT,
                photos_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES project_metadata(project_id)
            )
            """
        )
        conn.commit()


def save_inspection_entry(project_name: str, user_id: Optional[int], report_data: Dict[str, Any], photos: List[Dict[str, Any]]) -> int:
    """Guarda una jornada diaria de inspección con su fecha, datos y fotos."""
    init_db()
    project_id = project_name.strip().upper()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO daily_inspections (project_id, user_id, fecha, report_data, photos_data)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                project_id,
                user_id,
                report_data.get("fecha") or "",
                json.dumps(report_data, ensure_ascii=False),
                json.dumps(photos, ensure_ascii=False),
            ),
        )
        conn.commit()
        return cursor.lastrowid or 0


def get_inspections_for_project(project_name: str, limit: int = 15) -> List[Dict[str, Any]]:
    """Obtiene el historial de inspecciones registradas para una obra."""
    init_db()
    project_id = project_name.strip().upper()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, fecha, report_data, photos_data, created_at
            FROM daily_inspections
            WHERE project_id = ?
            ORDER BY id ASC
            LIMIT ?
            """,
            (project_id, limit),
        )
        rows = cursor.fetchall()
        results = []
        for r in rows:
            results.append({
                "id": r["id"],
                "fecha": r["fecha"],
                "report": json.loads(r["report_data"]) if r["report_data"] else {},
                "photos": json.loads(r["photos_data"]) if r["photos_data"] else [],
                "created_at": r["created_at"],
            })
        return results


def save_project_metadata(project_name: str, user_id: Optional[int], data: Dict[str, Any]) -> None:
    """Guarda o actualiza los datos generales de un proyecto."""
    init_db()
    project_id = project_name.strip().upper()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO project_metadata (
                project_id, user_id, obra, ente_contratante, firma_contratista,
                empresa_inspeccion, objeto_contrato, monto_contrato, fecha_contrato,
                fecha_inicio, fecha_terminacion, representante_legal, civ_representante,
                ing_residente, civ_residente, ing_inspector, civ_inspector, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(project_id) DO UPDATE SET
                user_id = COALESCE(excluded.user_id, project_metadata.user_id),
                obra = COALESCE(excluded.obra, project_metadata.obra),
                ente_contratante = COALESCE(excluded.ente_contratante, project_metadata.ente_contratante),
                firma_contratista = COALESCE(excluded.firma_contratista, project_metadata.firma_contratista),
                empresa_inspeccion = COALESCE(excluded.empresa_inspeccion, project_metadata.empresa_inspeccion),
                objeto_contrato = COALESCE(excluded.objeto_contrato, project_metadata.objeto_contrato),
                monto_contrato = COALESCE(excluded.monto_contrato, project_metadata.monto_contrato),
                fecha_contrato = COALESCE(excluded.fecha_contrato, project_metadata.fecha_contrato),
                fecha_inicio = COALESCE(excluded.fecha_inicio, project_metadata.fecha_inicio),
                fecha_terminacion = COALESCE(excluded.fecha_terminacion, project_metadata.fecha_terminacion),
                representante_legal = COALESCE(excluded.representante_legal, project_metadata.representante_legal),
                civ_representante = COALESCE(excluded.civ_representante, project_metadata.civ_representante),
                ing_residente = COALESCE(excluded.ing_residente, project_metadata.ing_residente),
                civ_residente = COALESCE(excluded.civ_residente, project_metadata.civ_residente),
                ing_inspector = COALESCE(excluded.ing_inspector, project_metadata.ing_inspector),
                civ_inspector = COALESCE(excluded.civ_inspector, project_metadata.civ_inspector),
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                project_id,
                user_id,
                data.get("obra", project_name),
                data.get("ente_contratante"),
                data.get("firma_contratista"),
                data.get("empresa_inspeccion"),
                data.get("objeto_contrato"),
                data.get("monto_contrato"),
                data.get("fecha_contrato"),
                data.get("fecha_inicio"),
                data.get("fecha_terminacion"),
                data.get("representante_legal"),
                data.get("civ_representante"),
                data.get("ing_residente"),
                data.get("civ_residente"),
                data.get("ing_inspector"),
                data.get("civ_inspector"),
            ),
        )
        conn.commit()


def _strip_accents_str(text: str) -> str:
    """Elimina acentos y diacríticos de una cadena de texto."""
    if not text:
        return ""
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def _tokenize_project(text: str) -> Set[str]:
    """Tokeniza un nombre de proyecto descartando palabras genéricas frecuentes."""
    norm = _strip_accents_str(text.lower())
    tokens = set(re.findall(r"[a-z0-9]{3,}", norm))
    generic_words = {
        "del", "los", "las", "para", "por", "con", "una", "sin", "entre",
        "libro", "obra", "test", "prueba", "rehabilitacion", "construccion",
        "integral", "proyecto", "mantenimiento", "reparacion", "unidad",
    }
    return tokens - generic_words


def get_project_metadata(project_name: str) -> Dict[str, Any]:
    """Obtiene los datos generales de un proyecto (coincidencia exacta o difusa inteligente)."""
    if not project_name or not project_name.strip():
        return {}
    init_db()
    project_id = project_name.strip().upper()
    with _get_connection() as conn:
        cursor = conn.cursor()
        # 1. Búsqueda exacta rápida
        cursor.execute("SELECT * FROM project_metadata WHERE project_id = ?", (project_id,))
        row = cursor.fetchone()
        if row:
            return dict(row)

        # 2. Búsqueda inteligente por tokens y similitud para nombres abreviados o resumidos
        cursor.execute("SELECT * FROM project_metadata")
        all_rows = cursor.fetchall()
        if not all_rows:
            return {}

        query_tokens = _tokenize_project(project_name)
        q_norm = _strip_accents_str(project_name.lower())

        best_row: Optional[sqlite3.Row] = None
        best_score = 0.0

        for r in all_rows:
            p_name = r["obra"] or r["project_id"]
            p_norm = _strip_accents_str(p_name.lower())

            # Coincidencia directa de subcadena (ej: "Ukatira" en "Rehabilitación Integral... Ukatira")
            if q_norm and (q_norm in p_norm or p_norm in q_norm):
                return dict(r)

            if query_tokens:
                p_tokens = _tokenize_project(p_name)
                common = query_tokens & p_tokens
                if common:
                    # Si coincide una palabra distintiva (>= 5 letras) o múltiples tokens
                    if len(common) >= 2 or any(len(w) >= 5 for w in common):
                        score = len(common) / len(query_tokens | p_tokens)
                        if score > best_score and score >= 0.25:
                            best_score = score
                            best_row = r

        if best_row:
            return dict(best_row)

        # Si solo hay un único proyecto registrado en la base de datos
        if len(all_rows) == 1 and not query_tokens:
            return dict(all_rows[0])

        return {}


def get_recent_projects(user_id: Optional[int] = None) -> List[str]:
    """Retorna la lista de proyectos registrados recientemente."""
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("SELECT obra FROM project_metadata WHERE user_id = ? ORDER BY updated_at DESC LIMIT 10", (user_id,))
        else:
            cursor.execute("SELECT obra FROM project_metadata ORDER BY updated_at DESC LIMIT 10")
        rows = cursor.fetchall()
        return [row["obra"] for row in rows if row["obra"]]


def delete_project_metadata(project_name: str) -> bool:
    """Elimina los metadatos de un proyecto de la base de datos."""
    init_db()
    project_id = project_name.strip().upper()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM project_metadata WHERE project_id = ?", (project_id,))
        conn.commit()
        return cursor.rowcount > 0
