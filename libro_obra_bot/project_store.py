"""
Gestor de persistencia en SQLite / JSON para proyectos y configuración de Libros de Obra.
Permite recordar los datos generales de la obra (residente, inspector, contratista, CIV, etc.)
por usuario o por proyecto para no tener que solicitarlos repetidamente.
"""
import json
import logging
import re
import secrets
import sqlite3
import unicodedata
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Set

from libro_obra_bot.config import DATA_DIR

logger = logging.getLogger(__name__)

DB_PATH = DATA_DIR / "inspector_bot.db"
MAX_PROJECT_MEMBERS = 2


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
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS user_last_reports (
                user_id INTEGER PRIMARY KEY,
                obra TEXT,
                message_text TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS sheet_reports (
                project_id TEXT,
                sheet_name TEXT,
                sheet_date TEXT,
                message_text TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (project_id, sheet_name)
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS project_members (
                project_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL DEFAULT 'editor',
                invited_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (project_id, user_id)
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS project_invites (
                code TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'editor',
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                used_by INTEGER,
                used_at TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS project_locks (
                project_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                acquired_at TIMESTAMP NOT NULL,
                expires_at TIMESTAMP NOT NULL
            )
            """
        )
        # Migración: el creador de cada libro existente queda como owner.
        cursor.execute(
            """
            INSERT OR IGNORE INTO project_members (project_id, user_id, role, invited_by)
            SELECT project_id, user_id, 'owner', user_id
            FROM project_metadata
            WHERE user_id IS NOT NULL
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
                user_id = project_metadata.user_id,
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
        if user_id is not None:
            cursor.execute(
                """
                INSERT OR IGNORE INTO project_members (project_id, user_id, role, invited_by)
                SELECT ?, ?, 'owner', ?
                WHERE EXISTS (
                    SELECT 1 FROM project_metadata
                    WHERE project_id = ? AND user_id = ?
                )
                """,
                (project_id, user_id, user_id, project_id, user_id),
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


def _project_key(project_name: str) -> str:
    return (project_name or "").strip().upper()


def get_project_owner(project_name: str) -> Optional[int]:
    """Retorna el user_id del creador del proyecto, si existe."""
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT user_id FROM project_metadata WHERE project_id = ?",
            (_project_key(project_name),),
        )
        row = cursor.fetchone()
        return row["user_id"] if row and row["user_id"] is not None else None


def ensure_owner_membership(project_name: str, user_id: Optional[int]) -> None:
    if user_id is None:
        return
    project_id = _project_key(project_name)
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR IGNORE INTO project_members (project_id, user_id, role, invited_by)
            VALUES (?, ?, 'owner', ?)
            """,
            (project_id, user_id, user_id),
        )
        conn.commit()


def can_access_project(project_name: str, user_id: Optional[int]) -> bool:
    """Indica si el usuario es miembro del libro (owner, editor o inspector)."""
    if not project_name or user_id is None:
        return False
    init_db()
    project_id = _project_key(project_name)
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?",
            (project_id, user_id),
        )
        if cursor.fetchone():
            return True
        cursor.execute(
            "SELECT user_id FROM project_metadata WHERE project_id = ?",
            (project_id,),
        )
        row = cursor.fetchone()
        if row and row["user_id"] == user_id:
            ensure_owner_membership(project_name, user_id)
            return True
    return False


def get_user_project_names(user_id: int) -> List[str]:
    """Proyectos donde el usuario es miembro activo."""
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT DISTINCT pm.obra
            FROM project_metadata pm
            JOIN project_members m ON m.project_id = pm.project_id
            WHERE m.user_id = ?
            ORDER BY pm.updated_at DESC
            """,
            (user_id,),
        )
        return [row["obra"] for row in cursor.fetchall() if row["obra"]]


def get_project_member_count(project_name: str) -> int:
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) AS n FROM project_members WHERE project_id = ?",
            (_project_key(project_name),),
        )
        row = cursor.fetchone()
        return int(row["n"]) if row else 0


def get_project_role(project_name: str, user_id: Optional[int]) -> Optional[str]:
    if user_id is None:
        return None
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
            (_project_key(project_name), user_id),
        )
        row = cursor.fetchone()
        return row["role"] if row else None


def get_pending_invite(project_name: str) -> Optional[Dict[str, Any]]:
    init_db()
    now = datetime.utcnow().isoformat(timespec="seconds")
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM project_invites
            WHERE project_id = ? AND used_by IS NULL AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (_project_key(project_name), now),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def revoke_pending_invites(project_name: str) -> int:
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM project_invites WHERE project_id = ? AND used_by IS NULL",
            (_project_key(project_name),),
        )
        conn.commit()
        return cursor.rowcount


def create_project_invite(
    project_name: str,
    created_by: int,
    role: str = "editor",
    expires_hours: int = 168,
) -> Dict[str, Any]:
    """Crea un código de invitación temporal, solo para el owner y con cupo."""
    if get_project_owner(project_name) != created_by:
        raise PermissionError("Solo el residente creador puede invitar.")
    if get_project_member_count(project_name) >= MAX_PROJECT_MEMBERS:
        raise PermissionError(
            f"El libro ya tiene {MAX_PROJECT_MEMBERS} usuarios. "
            "Revoca al inspector actual antes de invitar a otro."
        )
    pending = get_pending_invite(project_name)
    if pending:
        raise PermissionError(
            f"Ya existe la invitación {pending['code']} pendiente. "
            "Compártela o revócala antes de crear otra."
        )

    project_id = _project_key(project_name)
    code = secrets.token_urlsafe(9).replace("-", "").replace("_", "")[:12]
    expires_at = (datetime.utcnow() + timedelta(hours=expires_hours)).isoformat(timespec="seconds")

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute(
            "SELECT COUNT(*) AS n FROM project_members WHERE project_id = ?",
            (project_id,),
        )
        if int(cursor.fetchone()["n"]) >= MAX_PROJECT_MEMBERS:
            conn.rollback()
            raise PermissionError(
                f"El libro ya tiene {MAX_PROJECT_MEMBERS} usuarios. "
                "Revoca al inspector actual antes de invitar a otro."
            )
        cursor.execute(
            """
            SELECT code FROM project_invites
            WHERE project_id = ? AND used_by IS NULL AND expires_at > ?
            LIMIT 1
            """,
            (project_id, datetime.utcnow().isoformat(timespec="seconds")),
        )
        pending_row = cursor.fetchone()
        if pending_row:
            conn.rollback()
            raise PermissionError(
                f"Ya existe la invitación {pending_row['code']} pendiente. "
                "Compártela o revócala antes de crear otra."
            )
        cursor.execute(
            """
            INSERT INTO project_invites (code, project_id, role, created_by, expires_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (code, project_id, role, created_by, expires_at),
        )
        conn.commit()

    return {
        "code": code,
        "project_id": project_id,
        "project_name": project_name,
        "role": role,
        "expires_at": expires_at,
    }


def get_project_invite(code: str) -> Optional[Dict[str, Any]]:
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM project_invites WHERE code = ?", (code,))
        row = cursor.fetchone()
        return dict(row) if row else None


def accept_project_invite(code: str, user_id: int) -> Optional[Dict[str, Any]]:
    """Acepta una invitación y agrega al usuario como editor del libro."""
    invite = get_project_invite(code)
    if not invite or invite.get("used_by"):
        return None
    try:
        expires = datetime.fromisoformat(str(invite["expires_at"]))
        if expires < datetime.utcnow():
            return None
    except (TypeError, ValueError):
        return None

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute(
            "SELECT used_by, expires_at FROM project_invites WHERE code = ?",
            (code,),
        )
        current = cursor.fetchone()
        if not current or current["used_by"]:
            conn.rollback()
            return None
        try:
            if datetime.fromisoformat(str(current["expires_at"])) < datetime.utcnow():
                conn.rollback()
                return None
        except (TypeError, ValueError):
            conn.rollback()
            return None
        cursor.execute(
            "SELECT COUNT(*) AS n FROM project_members WHERE project_id = ?",
            (invite["project_id"],),
        )
        count = int(cursor.fetchone()["n"])
        if count >= MAX_PROJECT_MEMBERS:
            conn.rollback()
            return None
        cursor.execute(
            """
            INSERT OR IGNORE INTO project_members (project_id, user_id, role, invited_by)
            VALUES (?, ?, ?, ?)
            """,
            (invite["project_id"], user_id, invite.get("role") or "editor", invite["created_by"]),
        )
        cursor.execute(
            """
            UPDATE project_invites
            SET used_by = ?, used_at = CURRENT_TIMESTAMP
            WHERE code = ? AND used_by IS NULL
            """,
            (user_id, code),
        )
        cursor.execute(
            "SELECT obra FROM project_metadata WHERE project_id = ?",
            (invite["project_id"],),
        )
        row = cursor.fetchone()
        conn.commit()

    return {
        "project_id": invite["project_id"],
        "project_name": row["obra"] if row else invite["project_id"],
        "role": invite.get("role") or "editor",
    }


def list_project_members(project_name: str) -> List[Dict[str, Any]]:
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT user_id, role, created_at
            FROM project_members
            WHERE project_id = ?
            ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, created_at
            """,
            (_project_key(project_name),),
        )
        return [dict(row) for row in cursor.fetchall()]


def remove_project_member(
    project_name: str,
    user_id: int,
    removed_by: Optional[int] = None,
) -> bool:
    init_db()
    project_id = _project_key(project_name)
    owner = get_project_owner(project_name)
    if owner == user_id:
        return False
    if removed_by is not None and owner != removed_by:
        return False
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM project_members WHERE project_id = ? AND user_id = ?",
            (project_id, user_id),
        )
        conn.commit()
        removed = cursor.rowcount > 0
    if removed:
        revoke_pending_invites(project_name)
    return removed


def acquire_project_lock(
    project_name: str,
    user_id: int,
    ttl_minutes: int = 30,
) -> Dict[str, Any]:
    """Bloqueo de edición por obra para evitar escrituras simultáneas."""
    init_db()
    project_id = _project_key(project_name)
    now = datetime.utcnow()
    now_iso = now.isoformat(timespec="seconds")
    expires_iso = (now + timedelta(minutes=ttl_minutes)).isoformat(timespec="seconds")

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("DELETE FROM project_locks WHERE expires_at <= ?", (now_iso,))
        cursor.execute(
            "SELECT user_id, expires_at FROM project_locks WHERE project_id = ?",
            (project_id,),
        )
        row = cursor.fetchone()
        if row and row["user_id"] != user_id:
            conn.commit()
            return {
                "ok": False,
                "holder": row["user_id"],
                "expires_at": row["expires_at"],
            }
        cursor.execute(
            """
            INSERT INTO project_locks (project_id, user_id, acquired_at, expires_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
                user_id = excluded.user_id,
                acquired_at = excluded.acquired_at,
                expires_at = excluded.expires_at
            """,
            (project_id, user_id, now_iso, expires_iso),
        )
        conn.commit()

    return {"ok": True, "expires_at": expires_iso}


def release_project_lock(project_name: str, user_id: int) -> bool:
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM project_locks WHERE project_id = ? AND user_id = ?",
            (_project_key(project_name), user_id),
        )
        conn.commit()
        return cursor.rowcount > 0


def get_project_lock(project_name: str) -> Optional[Dict[str, Any]]:
    init_db()
    now = datetime.utcnow().isoformat(timespec="seconds")
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM project_locks WHERE expires_at <= ?", (now,))
        cursor.execute(
            "SELECT * FROM project_locks WHERE project_id = ?",
            (_project_key(project_name),),
        )
        row = cursor.fetchone()
        conn.commit()
        return dict(row) if row else None


def get_recent_projects(user_id: Optional[int] = None) -> List[str]:
    """Retorna la lista de proyectos registrados recientemente."""
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute(
                """
                SELECT DISTINCT pm.obra
                FROM project_metadata pm
                JOIN project_members m ON m.project_id = pm.project_id
                WHERE m.user_id = ?
                ORDER BY pm.updated_at DESC
                LIMIT 10
                """,
                (user_id,),
            )
        else:
            cursor.execute("SELECT obra FROM project_metadata ORDER BY updated_at DESC LIMIT 10")
        rows = cursor.fetchall()
        return [row["obra"] for row in rows if row["obra"]]


def delete_project_metadata(project_name: str) -> bool:
    """Elimina los metadatos de un proyecto de la base de datos."""
    init_db()
    project_id = _project_key(project_name)
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM project_metadata WHERE project_id = ?", (project_id,))
        cursor.execute("DELETE FROM project_members WHERE project_id = ?", (project_id,))
        cursor.execute("DELETE FROM project_invites WHERE project_id = ?", (project_id,))
        conn.commit()
        return cursor.rowcount > 0


def save_user_last_report(user_id: int, message_text: str, obra: Optional[str] = None) -> None:
    """Guarda o actualiza el último texto de reporte enviado por un usuario."""
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO user_last_reports (user_id, obra, message_text, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (user_id, obra or "", message_text),
        )
        conn.commit()


def get_user_last_report(user_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene el último texto de reporte registrado por el usuario."""
    init_db()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT user_id, obra, message_text, updated_at
            FROM user_last_reports
            WHERE user_id = ?
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        if row:
            return {
                "user_id": row["user_id"],
                "obra": row["obra"],
                "message_text": row["message_text"],
                "updated_at": row["updated_at"],
            }
        return None

def save_sheet_report(project_name: str, sheet_name: str, sheet_date: str, message_text: str) -> None:
    """Guarda o actualiza el texto del reporte asociado a una hoja específica del libro de obra."""
    if not project_name:
        raise ValueError("project_name no puede estar vacío.")
    if not sheet_name:
        raise ValueError("sheet_name no puede estar vacío.")
    if not message_text:
        raise ValueError("message_text no puede estar vacío.")

    init_db()
    project_id = project_name.strip().upper()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO sheet_reports (project_id, sheet_name, sheet_date, message_text, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (project_id, str(sheet_name), str(sheet_date or ""), message_text),
        )
        conn.commit()


def get_sheet_report(project_name: str, sheet_name: str) -> Optional[str]:
    """Obtiene el texto del reporte guardado para una hoja específica."""
    if not project_name or not sheet_name:
        return None
    init_db()
    project_id = project_name.strip().upper()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT message_text FROM sheet_reports
            WHERE project_id = ? AND sheet_name = ?
            """,
            (project_id, str(sheet_name)),
        )
        row = cursor.fetchone()
        if row and row["message_text"]:
            return str(row["message_text"])
    return None


def get_sheet_report_by_date(project_name: str, sheet_date: str) -> Optional[str]:
    """Obtiene el texto del reporte guardado para una fecha específica en un proyecto."""
    if not project_name or not sheet_date:
        return None
    init_db()
    project_id = project_name.strip().upper()
    clean_d = sheet_date.strip()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT message_text FROM sheet_reports
            WHERE project_id = ? AND sheet_date = ?
            ORDER BY updated_at DESC LIMIT 1
            """,
            (project_id, clean_d),
        )
        row = cursor.fetchone()
        if row and row["message_text"]:
            return str(row["message_text"])
    return None


def update_sheet_reports_dates(
    project_name: str,
    date_shifts: List[Dict[str, str]],
) -> None:
    """
    Actualiza las fechas y el texto del reporte en sheet_reports tras un desplazamiento correlativo.
    date_shifts: lista de dicts con keys: sheet_name, old_date_str, new_date_str.
    """
    if not project_name:
        raise ValueError("project_name no puede estar vacío.")
    if not date_shifts:
        return

    init_db()
    project_id = project_name.strip().upper()
    with _get_connection() as conn:
        cursor = conn.cursor()
        for item in date_shifts:
            s_name = str(item["sheet_name"])
            old_d = str(item.get("old_date_str") or "").strip()
            new_d = str(item.get("new_date_str") or "").strip()

            cursor.execute(
                "SELECT message_text FROM sheet_reports WHERE project_id = ? AND sheet_name = ?",
                (project_id, s_name),
            )
            row = cursor.fetchone()
            if row and row["message_text"]:
                old_text = str(row["message_text"])
                if old_d:
                    new_text = re.sub(
                        r"(\*?Fecha:\*?\s*)" + re.escape(old_d),
                        r"\g<1>" + new_d,
                        old_text,
                        flags=re.IGNORECASE,
                    )
                else:
                    new_text = old_text
                cursor.execute(
                    """
                    UPDATE sheet_reports
                    SET sheet_date = ?, message_text = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE project_id = ? AND sheet_name = ?
                    """,
                    (new_d, new_text, project_id, s_name),
                )
            else:
                cursor.execute(
                    """
                    UPDATE sheet_reports
                    SET sheet_date = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE project_id = ? AND sheet_name = ?
                    """,
                    (new_d, project_id, s_name),
                )
        conn.commit()


def sync_sheet_reports_after_restructure(
    project_name: str,
    updated_sheets: List[Dict[str, str]],
) -> None:
    """
    Reorganiza y sincroniza atómicamente la tabla sheet_reports tras fusionar o renumerar hojas.
    updated_sheets: lista de dicts con keys: sheet_name, sheet_date, message_text.
    """
    if not project_name:
        raise ValueError("project_name no puede estar vacío.")

    init_db()
    project_id = project_name.strip().upper()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sheet_reports WHERE project_id = ?", (project_id,))
        for item in updated_sheets:
            s_name = str(item["sheet_name"])
            s_date = str(item.get("sheet_date") or "").strip()
            m_text = str(item.get("message_text") or "").strip()
            cursor.execute(
                """
                INSERT INTO sheet_reports (project_id, sheet_name, sheet_date, message_text, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (project_id, s_name, s_date, m_text),
            )
        conn.commit()


def build_message_text_from_sheet_data(
    entry_data: Dict[str, Any],
    general_data: Dict[str, Any],
) -> str:
    """
    Reconstruye el mensaje en formato estándar de inspección a partir de los datos de una hoja y obra.
    """
    if not entry_data:
        raise ValueError("entry_data no puede estar vacío.")

    fecha = entry_data.get("fecha") or ""
    obra = general_data.get("obra") or entry_data.get("obra") or ""
    lines: List[str] = [
        f"*Fecha:* {fecha}",
        f"*Obra:* {obra}",
    ]
    if general_data.get("empresa"):
        lines.append(f"*Nombre de la empresa:* {general_data['empresa']}")
    if general_data.get("ing_residente"):
        civ_res = general_data.get("civ_residente", "")
        civ_str = f"\nCIV: {civ_res}" if civ_res else ""
        lines.append(f"*Ing. Residente:* {general_data['ing_residente']}{civ_str}")
    if entry_data.get("personal_inspeccion"):
        lines.append(f"*Personal de Inspección:* {entry_data['personal_inspeccion']}")
    if entry_data.get("personal"):
        lines.append(f"*Personal en Obra:* {entry_data['personal']}")

    act_list = entry_data.get("actividades_list") or []
    if act_list:
        lines.append("*Actividades en ejecución:*")
        for a in act_list:
            lines.append(f".- {a}")
    elif entry_data.get("descripcion_labor"):
        lines.append(f"*Actividades en ejecución:*\n{entry_data['descripcion_labor']}")

    if entry_data.get("equipos"):
        lines.append(f"*Movimientos de maquinaria y equipos:*\n{entry_data['equipos']}")
    if entry_data.get("observaciones"):
        lines.append(f"*Observaciones:*\n{entry_data['observaciones']}")

    return "\n".join(lines)
