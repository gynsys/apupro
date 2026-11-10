"""Servicio de creación e importación de bases de datos CostBase desde Maprex/Lulo.

Soporta dos esquemas de datos comunes en Maprex:
1. Esquema Obra/Proyecto: ObraPart, ObraMate, ObraEqui, ObraMano, ObraPain*
2. Esquema Base Maestra BDD: Partidas, Materiales, Equipos, ManodeObra, Partidas*, Zonas*

Acepta tanto archivos Access (.mdb, .accdb, .prx vía mdbtools) como archivos .zip con CSVs.
Garantiza el cálculo correcto de CosDia (costo diario de equipos = precio * factor depreciación)
e inserta índices de alto rendimiento en el esquema creado.
"""

from __future__ import annotations

import csv
import io
import os
import re
import shutil
import subprocess
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.crud.crud_costbase import validate_schema_name
from app.db.models.costbase_database import Cost360Database

MDB_TABLES = "mdb-tables"
MDB_EXPORT = "mdb-export"

# Tablas esperadas de Maprex para bases de datos
ALL_POSSIBLE_TABLES = [
    # Esquema Obra / Catálogo
    "ObraPart",
    "ObraMate",
    "ObraEqui",
    "ObraMano",
    "ObraPainMate",
    "ObraPainEqui",
    "ObraPainMano",
    "ObraProy",
    "ObraApun",
    # Esquema Base Maestra BDD
    "Partidas",
    "Materiales",
    "Equipos",
    "ManodeObra",
    "PartidasMateriales",
    "PartidasEquipos",
    "PartidasManodeObra",
    "ZonasMateriales",
    "ZonasEquipos",
    "ZonasManoDeObra",
    "TasaCambio",
]


class MdbDatabaseImportError(Exception):
    """Excepción para errores controlados de importación de base de datos desde Access."""


def _get_binary_path(name: str) -> str:
    """Obtiene la ruta de un binario del sistema validando su presencia."""
    path = shutil.which(name)
    if not path:
        raise MdbDatabaseImportError(
            f"El servidor no tiene '{name}' instalado. Contacte al administrador del sistema."
        )
    return path


def _run_shell_command(argv: List[str], timeout: int = 180) -> str:
    """Ejecuta un comando del sistema de forma segura con timeout."""
    try:
        result = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise MdbDatabaseImportError("El procesamiento del archivo Access excedió el tiempo límite.") from exc
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise MdbDatabaseImportError(
            "No se pudo leer el archivo con mdbtools. Si es Access 1.0/2.0 o tiene contraseña, "
            f"use el exportador ZIP de CSV: {detail[:400]}"
        )
    return result.stdout


def _parse_float(value: Any, default: float = 0.0) -> float:
    """Convierte de forma segura cadenas numéricas con coma o punto a float."""
    if value is None:
        return default
    text_val = str(value).strip().replace(",", ".")
    if not text_val:
        return default
    try:
        parsed = float(text_val)
        return parsed if not (parsed != parsed) else default  # Check NaN
    except ValueError:
        return default


def _clean_str(value: Any) -> str:
    """Limpia cadenas eliminando espacios y caracteres nulos."""
    if value is None:
        return ""
    return str(value).strip()


def _read_mdb_raw_tables(mdb_path: str) -> Dict[str, List[Dict[str, str]]]:
    """Lee todas las tablas disponibles en un archivo MDB usando mdbtools."""
    bin_tables = _get_binary_path(MDB_TABLES)
    bin_export = _get_binary_path(MDB_EXPORT)

    output = _run_shell_command([bin_tables, "-1", mdb_path])
    available = {line.strip() for line in output.splitlines() if line.strip()}
    available_lower = {name.lower(): name for name in available}

    tables: Dict[str, List[Dict[str, str]]] = {}
    for table_name in ALL_POSSIBLE_TABLES:
        matched_real_name = available_lower.get(table_name.lower())
        if not matched_real_name:
            continue
        raw_csv = _run_shell_command([bin_export, mdb_path, matched_real_name])
        tables[table_name.lower()] = list(csv.DictReader(io.StringIO(raw_csv)))

    return tables


def _read_zip_raw_tables(zip_path: str) -> Dict[str, List[Dict[str, str]]]:
    """Lee un archivo ZIP con archivos CSV exportados desde Windows DAO."""
    tables: Dict[str, List[Dict[str, str]]] = {}
    try:
        with zipfile.ZipFile(zip_path) as archive:
            names_map = {
                Path(name).stem.lower(): name
                for name in archive.namelist()
                if name.lower().endswith(".csv")
            }
            for table_name in ALL_POSSIBLE_TABLES:
                member = names_map.get(table_name.lower())
                if not member:
                    continue
                with archive.open(member) as fh:
                    text_stream = io.TextIOWrapper(fh, encoding="utf-8-sig", errors="replace", newline="")
                    tables[table_name.lower()] = list(csv.DictReader(text_stream))
    except zipfile.BadZipFile as exc:
        raise MdbDatabaseImportError("El archivo ZIP suministrado está corrupto o no es válido.") from exc

    return tables


def _generate_clean_schema_id(db: Session, base_name: str) -> str:
    """Genera un nombre de esquema PostgreSQL válido y no existente."""
    clean_slug = re.sub(r'[^a-z0-9_]', '', base_name.lower().replace(' ', '_').replace('-', '_'))
    if not clean_slug:
        clean_slug = "maprex_base"
    if not clean_slug.startswith("base_"):
        clean_slug = f"base_{clean_slug}"
    # Truncar slug base a un tamaño seguro
    clean_slug = clean_slug[:32]
    
    unique_suffix = str(uuid.uuid4())[:6]
    candidate = f"{clean_slug}_{unique_suffix}"
    
    # Verificar si existe en la base de datos
    while True:
        exists = db.execute(
            text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :s"),
            {"s": candidate}
        ).scalar()
        if not exists:
            break
        unique_suffix = str(uuid.uuid4())[:6]
        candidate = f"{clean_slug}_{unique_suffix}"

    if not validate_schema_name(candidate):
        raise MdbDatabaseImportError(f"Nombre de esquema generado no es seguro: {candidate}")

    return candidate


def create_costbase_schema_tables(db: Session, schema_name: str) -> None:
    """Crea la estructura física completa de tablas e índices en el nuevo esquema."""
    if not validate_schema_name(schema_name):
        raise MdbDatabaseImportError(f"Identificador de esquema no válido: {schema_name}")

    create_schema_sql = f'CREATE SCHEMA "{schema_name}";'
    db.execute(text(create_schema_sql))

    tables_ddl = f"""
    CREATE TABLE "{schema_name}".cost360_items (
        "CodPar" VARCHAR PRIMARY KEY,
        "Descri" TEXT,
        "CovPar" VARCHAR,
        "UniPar" VARCHAR,
        "PreUni" FLOAT,
        "RenPar" FLOAT,
        "Categoria" VARCHAR,
        "TipoActividad" VARCHAR,
        disciplina VARCHAR,
        diametro_pulg VARCHAR,
        resistencia_fc FLOAT,
        material VARCHAR,
        preparacion VARCHAR,
        desc_limpia VARCHAR
    );

    CREATE TABLE "{schema_name}".cost360_materials (
        "CodMat" VARCHAR PRIMARY KEY,
        "Descri" TEXT,
        "UniMat" VARCHAR,
        "CosMat" FLOAT,
        ref_code VARCHAR,
        family_id VARCHAR,
        market_indicator_id VARCHAR,
        market_factor FLOAT DEFAULT 1.0
    );

    CREATE TABLE "{schema_name}".cost360_equipment (
        "CodEqu" VARCHAR PRIMARY KEY,
        "Descri" TEXT,
        "CosDia" FLOAT,
        ref_code VARCHAR,
        precio FLOAT,
        deprec_factor FLOAT
    );

    CREATE TABLE "{schema_name}".cost360_labor (
        "CodMan" VARCHAR PRIMARY KEY,
        "Descri" TEXT,
        "Jornal" FLOAT,
        "Bono" FLOAT,
        ref_code VARCHAR
    );

    CREATE TABLE "{schema_name}".cost360_apu_materials (
        "CodPar" VARCHAR NOT NULL,
        "CodIns" VARCHAR NOT NULL,
        "CanIns" FLOAT,
        "Desper" FLOAT,
        PRIMARY KEY ("CodPar", "CodIns")
    );

    CREATE TABLE "{schema_name}".cost360_apu_equipment (
        "CodPar" VARCHAR NOT NULL,
        "CodIns" VARCHAR NOT NULL,
        "CanIns" FLOAT,
        "Deprec" FLOAT,
        PRIMARY KEY ("CodPar", "CodIns")
    );

    CREATE TABLE "{schema_name}".cost360_apu_labor (
        "CodPar" VARCHAR NOT NULL,
        "CodIns" VARCHAR NOT NULL,
        "CanIns" FLOAT,
        PRIMARY KEY ("CodPar", "CodIns")
    );
    """
    db.execute(text(tables_ddl))


def create_costbase_schema_indexes(db: Session, schema_name: str) -> None:
    """Crea índices para búsquedas optimizadas en el esquema."""
    indexes_ddl = f"""
    CREATE INDEX IF NOT EXISTS "idx_{schema_name}_items_codpar" ON "{schema_name}".cost360_items ("CodPar");
    CREATE INDEX IF NOT EXISTS "idx_{schema_name}_items_covpar" ON "{schema_name}".cost360_items ("CovPar");
    CREATE INDEX IF NOT EXISTS "idx_{schema_name}_items_descri" ON "{schema_name}".cost360_items USING gin (to_tsvector('spanish', coalesce("Descri", '')));
    CREATE INDEX IF NOT EXISTS "idx_{schema_name}_materials_codmat" ON "{schema_name}".cost360_materials ("CodMat");
    CREATE INDEX IF NOT EXISTS "idx_{schema_name}_equipment_codequ" ON "{schema_name}".cost360_equipment ("CodEqu");
    CREATE INDEX IF NOT EXISTS "idx_{schema_name}_labor_codman" ON "{schema_name}".cost360_labor ("CodMan");
    CREATE INDEX IF NOT EXISTS "idx_{schema_name}_apumat_codpar" ON "{schema_name}".cost360_apu_materials ("CodPar");
    CREATE INDEX IF NOT EXISTS "idx_{schema_name}_apueq_codpar" ON "{schema_name}".cost360_apu_equipment ("CodPar");
    CREATE INDEX IF NOT EXISTS "idx_{schema_name}_apulab_codpar" ON "{schema_name}".cost360_apu_labor ("CodPar");
    """
    try:
        db.execute(text(indexes_ddl))
    except Exception as exc:
        logger.warning("Fallo creando índices avanzados (continuando con índices estándar): %s", exc)


def _populate_from_tables(
    db: Session,
    schema_name: str,
    tables: Dict[str, List[Dict[str, str]]],
) -> Dict[str, int]:
    """Identifica el formato de Maprex e inserta los catálogos en el esquema."""
    has_obra_format = bool(tables.get("obrapart") or tables.get("obramate"))
    has_bdd_format = bool(tables.get("partidas") or tables.get("materiales"))

    if not has_obra_format and not has_bdd_format:
        available = ", ".join(tables.keys())
        raise MdbDatabaseImportError(
            f"El archivo no contiene tablas reconocidas de Maprex. Tablas halladas: {available or 'ninguna'}"
        )

    counts = {
        "items": 0,
        "materials": 0,
        "equipment": 0,
        "labor": 0,
        "apu_materials": 0,
        "apu_equipment": 0,
        "apu_labor": 0,
    }

    # =========================================================================
    # CASO 1: Formato Obra / Catálogo Maprex (ObraPart, ObraMate, ObraEqui...)
    # =========================================================================
    if has_obra_format:
        logger.info("[MDB_DB_IMPORT] Procesando formato Obra/Catálogo para %s", schema_name)
        
        # 1. Partidas
        raw_parts = tables.get("obrapart", [])
        items_batch: List[Dict[str, Any]] = []
        seen_parts: Set[str] = set()
        for r in raw_parts:
            cod = _clean_str(r.get("CodPar"))
            if not cod or cod in seen_parts:
                continue
            seen_parts.add(cod)
            cov = _clean_str(r.get("CovPar")) or None
            desc = _clean_str(r.get("Descri")) or cod
            uni = _clean_str(r.get("UniPar")) or "UND"
            ren = _parse_float(r.get("RenPar"), default=1.0)
            pre = _parse_float(r.get("PreUni"), default=0.0)
            items_batch.append({
                "CodPar": cod,
                "CovPar": cov,
                "Descri": desc,
                "UniPar": uni,
                "RenPar": ren if ren > 0 else 1.0,
                "PreUni": pre,
                "Categoria": "Partida",
                "TipoActividad": "Construcción",
            })
            if len(items_batch) >= 1000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_items 
                        ("CodPar", "CovPar", "Descri", "UniPar", "RenPar", "PreUni", "Categoria", "TipoActividad")
                        VALUES (:CodPar, :CovPar, :Descri, :UniPar, :RenPar, :PreUni, :Categoria, :TipoActividad)
                        ON CONFLICT ("CodPar") DO NOTHING
                    """),
                    items_batch
                )
                counts["items"] += len(items_batch)
                items_batch = []
        if items_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_items 
                    ("CodPar", "CovPar", "Descri", "UniPar", "RenPar", "PreUni", "Categoria", "TipoActividad")
                    VALUES (:CodPar, :CovPar, :Descri, :UniPar, :RenPar, :PreUni, :Categoria, :TipoActividad)
                    ON CONFLICT ("CodPar") DO NOTHING
                """),
                items_batch
            )
            counts["items"] += len(items_batch)

        # 2. Materiales
        raw_mat = tables.get("obramate", [])
        mat_batch: List[Dict[str, Any]] = []
        seen_mat: Set[str] = set()
        for r in raw_mat:
            cod = _clean_str(r.get("CodMat"))
            if not cod or cod in seen_mat:
                continue
            seen_mat.add(cod)
            desc = _clean_str(r.get("Descri")) or cod
            uni = _clean_str(r.get("UniMat")) or "UND"
            cos = _parse_float(r.get("CosMat"), default=0.0)
            fam = _clean_str(r.get("CodFam")) or None
            mat_batch.append({
                "CodMat": cod,
                "Descri": desc,
                "UniMat": uni,
                "CosMat": cos,
                "family_id": fam,
                "ref_code": fam,
                "market_factor": 1.0
            })
            if len(mat_batch) >= 1000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_materials 
                        ("CodMat", "Descri", "UniMat", "CosMat", "family_id", "ref_code", "market_factor")
                        VALUES (:CodMat, :Descri, :UniMat, :CosMat, :family_id, :ref_code, :market_factor)
                        ON CONFLICT ("CodMat") DO NOTHING
                    """),
                    mat_batch
                )
                counts["materials"] += len(mat_batch)
                mat_batch = []
        if mat_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_materials 
                    ("CodMat", "Descri", "UniMat", "CosMat", "family_id", "ref_code", "market_factor")
                    VALUES (:CodMat, :Descri, :UniMat, :CosMat, :family_id, :ref_code, :market_factor)
                    ON CONFLICT ("CodMat") DO NOTHING
                """),
                mat_batch
            )
            counts["materials"] += len(mat_batch)

        # 3. Equipos (Con cálculo robusto de CosDia = precio * deprec_factor)
        raw_eq = tables.get("obraequi", [])
        eq_batch: List[Dict[str, Any]] = []
        seen_eq: Set[str] = set()
        for r in raw_eq:
            cod = _clean_str(r.get("CodEqu"))
            if not cod or cod in seen_eq:
                continue
            seen_eq.add(cod)
            desc = _clean_str(r.get("Descri")) or cod
            precio = _parse_float(r.get("CosEqu"), default=0.0)
            deprec = _parse_float(r.get("Deprec"), default=1.0)
            if deprec <= 0:
                deprec = 1.0
            cosdia_raw = _parse_float(r.get("CosDia"), default=0.0)
            # REGLA DE ORO: Si CosDia es 0 pero hay precio, calcularlo!
            if cosdia_raw > 0:
                cosdia = cosdia_raw
            else:
                cosdia = round(precio * deprec, 4)

            fam = _clean_str(r.get("CodFam")) or None
            eq_batch.append({
                "CodEqu": cod,
                "Descri": desc,
                "precio": precio,
                "deprec_factor": deprec,
                "CosDia": cosdia,
                "ref_code": fam
            })
            if len(eq_batch) >= 1000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_equipment 
                        ("CodEqu", "Descri", "precio", "deprec_factor", "CosDia", "ref_code")
                        VALUES (:CodEqu, :Descri, :precio, :deprec_factor, :CosDia, :ref_code)
                        ON CONFLICT ("CodEqu") DO NOTHING
                    """),
                    eq_batch
                )
                counts["equipment"] += len(eq_batch)
                eq_batch = []
        if eq_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_equipment 
                    ("CodEqu", "Descri", "precio", "deprec_factor", "CosDia", "ref_code")
                    VALUES (:CodEqu, :Descri, :precio, :deprec_factor, :CosDia, :ref_code)
                    ON CONFLICT ("CodEqu") DO NOTHING
                """),
                eq_batch
            )
            counts["equipment"] += len(eq_batch)

        # 4. Mano de Obra
        raw_lab = tables.get("obramano", [])
        lab_batch: List[Dict[str, Any]] = []
        seen_lab: Set[str] = set()
        for r in raw_lab:
            cod = _clean_str(r.get("CodMan"))
            if not cod or cod in seen_lab:
                continue
            seen_lab.add(cod)
            desc = _clean_str(r.get("Descri")) or cod
            jornal = _parse_float(r.get("Salari"), default=0.0)
            bono = _parse_float(r.get("Superv"), default=0.0)
            fam = _clean_str(r.get("CodFam")) or None
            lab_batch.append({
                "CodMan": cod,
                "Descri": desc,
                "Jornal": jornal,
                "Bono": bono,
                "ref_code": fam
            })
            if len(lab_batch) >= 1000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_labor 
                        ("CodMan", "Descri", "Jornal", "Bono", "ref_code")
                        VALUES (:CodMan, :Descri, :Jornal, :Bono, :ref_code)
                        ON CONFLICT ("CodMan") DO NOTHING
                    """),
                    lab_batch
                )
                counts["labor"] += len(lab_batch)
                lab_batch = []
        if lab_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_labor 
                    ("CodMan", "Descri", "Jornal", "Bono", "ref_code")
                    VALUES (:CodMan, :Descri, :Jornal, :Bono, :ref_code)
                    ON CONFLICT ("CodMan") DO NOTHING
                """),
                lab_batch
            )
            counts["labor"] += len(lab_batch)

        # 5. Recetas APU Materiales
        raw_apumat = tables.get("obrapainmate", [])
        apumat_batch: List[Dict[str, Any]] = []
        seen_apumat: Set[Tuple[str, str]] = set()
        for r in raw_apumat:
            par = _clean_str(r.get("CodPar"))
            ins = _clean_str(r.get("CodIns"))
            if not par or not ins or (par, ins) in seen_apumat:
                continue
            seen_apumat.add((par, ins))
            can = _parse_float(r.get("CanIns"), default=0.0)
            desp = _parse_float(r.get("Desper"), default=0.0)
            apumat_batch.append({"CodPar": par, "CodIns": ins, "CanIns": can, "Desper": desp})
            if len(apumat_batch) >= 2000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_apu_materials ("CodPar", "CodIns", "CanIns", "Desper")
                        VALUES (:CodPar, :CodIns, :CanIns, :Desper)
                        ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                    """),
                    apumat_batch
                )
                counts["apu_materials"] += len(apumat_batch)
                apumat_batch = []
        if apumat_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_apu_materials ("CodPar", "CodIns", "CanIns", "Desper")
                    VALUES (:CodPar, :CodIns, :CanIns, :Desper)
                    ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                """),
                apumat_batch
            )
            counts["apu_materials"] += len(apumat_batch)

        # 6. Recetas APU Equipos
        raw_apueq = tables.get("obrapainequi", [])
        apueq_batch: List[Dict[str, Any]] = []
        seen_apueq: Set[Tuple[str, str]] = set()
        for r in raw_apueq:
            par = _clean_str(r.get("CodPar"))
            ins = _clean_str(r.get("CodIns"))
            if not par or not ins or (par, ins) in seen_apueq:
                continue
            seen_apueq.add((par, ins))
            can = _parse_float(r.get("CanIns"), default=0.0)
            dep = _parse_float(r.get("Deprec"), default=1.0)
            apueq_batch.append({"CodPar": par, "CodIns": ins, "CanIns": can, "Deprec": dep})
            if len(apueq_batch) >= 2000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_apu_equipment ("CodPar", "CodIns", "CanIns", "Deprec")
                        VALUES (:CodPar, :CodIns, :CanIns, :Deprec)
                        ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                    """),
                    apueq_batch
                )
                counts["apu_equipment"] += len(apueq_batch)
                apueq_batch = []
        if apueq_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_apu_equipment ("CodPar", "CodIns", "CanIns", "Deprec")
                    VALUES (:CodPar, :CodIns, :CanIns, :Deprec)
                    ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                """),
                apueq_batch
            )
            counts["apu_equipment"] += len(apueq_batch)

        # 7. Recetas APU Mano de Obra
        raw_apulab = tables.get("obrapainmano", [])
        apulab_batch: List[Dict[str, Any]] = []
        seen_apulab: Set[Tuple[str, str]] = set()
        for r in raw_apulab:
            par = _clean_str(r.get("CodPar"))
            ins = _clean_str(r.get("CodIns"))
            if not par or not ins or (par, ins) in seen_apulab:
                continue
            seen_apulab.add((par, ins))
            can = _parse_float(r.get("CanIns"), default=0.0)
            apulab_batch.append({"CodPar": par, "CodIns": ins, "CanIns": can})
            if len(apulab_batch) >= 2000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_apu_labor ("CodPar", "CodIns", "CanIns")
                        VALUES (:CodPar, :CodIns, :CanIns)
                        ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                    """),
                    apulab_batch
                )
                counts["apu_labor"] += len(apulab_batch)
                apulab_batch = []
        if apulab_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_apu_labor ("CodPar", "CodIns", "CanIns")
                    VALUES (:CodPar, :CodIns, :CanIns)
                    ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                """),
                apulab_batch
            )
            counts["apu_labor"] += len(apulab_batch)

    # =========================================================================
    # CASO 2: Formato Base Maestra BDD Maprex (Partidas, Materiales, Equipos...)
    # =========================================================================
    else:
        logger.info("[MDB_DB_IMPORT] Procesando formato Base Maestra BDD para %s", schema_name)
        # Zonas de precios si están presentes para enriquecer materiales/equipos/mano de obra
        zonas_mat = {
            _clean_str(z.get("ReferenciaMaterial")): _parse_float(z.get("Precio"))
            for z in tables.get("zonasmateriales", [])
            if _clean_str(z.get("ReferenciaMaterial")) and _parse_float(z.get("Precio")) > 0
        }
        zonas_eq = {
            _clean_str(z.get("ReferenciaEquipo")): (_parse_float(z.get("Precio")), _parse_float(z.get("Depreciacion"), default=1.0))
            for z in tables.get("zonasequipos", [])
            if _clean_str(z.get("ReferenciaEquipo")) and _parse_float(z.get("Precio")) > 0
        }
        zonas_lab = {
            _clean_str(z.get("ReferenciaManodeObra")): (_parse_float(z.get("Jornal")), _parse_float(z.get("Bono")))
            for z in tables.get("zonasmanodeobra", [])
            if _clean_str(z.get("ReferenciaManodeObra"))
        }

        # 1. Partidas
        raw_parts = tables.get("partidas", [])
        items_batch = []
        seen_parts = set()
        for r in raw_parts:
            ref = _clean_str(r.get("Referencia"))
            if not ref or ref in seen_parts:
                continue
            seen_parts.add(ref)
            cov = _clean_str(r.get("Codigo")) or None
            desc = _clean_str(r.get("Descripcion")) or ref
            uni = _clean_str(r.get("Unidad")) or "UND"
            ren = _parse_float(r.get("Rendimiento"), default=1.0)
            pre = _parse_float(r.get("Precio"), default=0.0)
            items_batch.append({
                "CodPar": ref,
                "CovPar": cov,
                "Descri": desc,
                "UniPar": uni,
                "RenPar": ren if ren > 0 else 1.0,
                "PreUni": pre,
                "Categoria": "Partida",
                "TipoActividad": "Construcción",
            })
            if len(items_batch) >= 1000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_items 
                        ("CodPar", "CovPar", "Descri", "UniPar", "RenPar", "PreUni", "Categoria", "TipoActividad")
                        VALUES (:CodPar, :CovPar, :Descri, :UniPar, :RenPar, :PreUni, :Categoria, :TipoActividad)
                        ON CONFLICT ("CodPar") DO NOTHING
                    """),
                    items_batch
                )
                counts["items"] += len(items_batch)
                items_batch = []
        if items_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_items 
                    ("CodPar", "CovPar", "Descri", "UniPar", "RenPar", "PreUni", "Categoria", "TipoActividad")
                    VALUES (:CodPar, :CovPar, :Descri, :UniPar, :RenPar, :PreUni, :Categoria, :TipoActividad)
                    ON CONFLICT ("CodPar") DO NOTHING
                """),
                items_batch
            )
            counts["items"] += len(items_batch)

        # 2. Materiales
        raw_mat = tables.get("materiales", [])
        mat_batch = []
        seen_mat = set()
        for r in raw_mat:
            ref = _clean_str(r.get("Referencia"))
            if not ref or ref in seen_mat:
                continue
            seen_mat.add(ref)
            desc = _clean_str(r.get("Descripcion")) or ref
            uni = _clean_str(r.get("Unidad")) or "UND"
            cos = zonas_mat.get(ref) or _parse_float(r.get("PrecioDollar") or r.get("Precio"), default=0.0)
            fam = _clean_str(r.get("ReferenciaFamilia")) or None
            mat_batch.append({
                "CodMat": ref,
                "Descri": desc,
                "UniMat": uni,
                "CosMat": cos,
                "family_id": fam,
                "ref_code": fam,
                "market_factor": 1.0
            })
            if len(mat_batch) >= 1000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_materials 
                        ("CodMat", "Descri", "UniMat", "CosMat", "family_id", "ref_code", "market_factor")
                        VALUES (:CodMat, :Descri, :UniMat, :CosMat, :family_id, :ref_code, :market_factor)
                        ON CONFLICT ("CodMat") DO NOTHING
                    """),
                    mat_batch
                )
                counts["materials"] += len(mat_batch)
                mat_batch = []
        if mat_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_materials 
                    ("CodMat", "Descri", "UniMat", "CosMat", "family_id", "ref_code", "market_factor")
                    VALUES (:CodMat, :Descri, :UniMat, :CosMat, :family_id, :ref_code, :market_factor)
                    ON CONFLICT ("CodMat") DO NOTHING
                """),
                mat_batch
            )
            counts["materials"] += len(mat_batch)

        # 3. Equipos
        raw_eq = tables.get("equipos", [])
        eq_batch = []
        seen_eq = set()
        for r in raw_eq:
            ref = _clean_str(r.get("Referencia"))
            if not ref or ref in seen_eq:
                continue
            seen_eq.add(ref)
            desc = _clean_str(r.get("Descripcion")) or ref
            precio = _parse_float(r.get("PrecioCostoDolar") or r.get("PrecioCosto"), default=0.0)
            deprec = _parse_float(r.get("DepreciacionCOP") or r.get("Depreciacion"), default=1.0)
            if deprec <= 0:
                deprec = 1.0

            p_dol = _parse_float(r.get("PrecioDollar") or r.get("Precio"), default=0.0)
            if ref in zonas_eq:
                z_p, z_d = zonas_eq[ref]
                p_dol = z_p
                if z_d > 0:
                    deprec = z_d

            if deprec < 0.99 and p_dol > 0:
                cosdia = round(p_dol * deprec, 4)
            elif p_dol > 0:
                cosdia = p_dol
            else:
                cosdia = round(precio * deprec, 4)

            fam = _clean_str(r.get("ReferenciaTipoEquipo")) or None
            eq_batch.append({
                "CodEqu": ref,
                "Descri": desc,
                "precio": precio if precio > 0 else (cosdia if deprec >= 1.0 else round(cosdia / deprec, 2)),
                "deprec_factor": deprec,
                "CosDia": cosdia,
                "ref_code": fam
            })
            if len(eq_batch) >= 1000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_equipment 
                        ("CodEqu", "Descri", "precio", "deprec_factor", "CosDia", "ref_code")
                        VALUES (:CodEqu, :Descri, :precio, :deprec_factor, :CosDia, :ref_code)
                        ON CONFLICT ("CodEqu") DO NOTHING
                    """),
                    eq_batch
                )
                counts["equipment"] += len(eq_batch)
                eq_batch = []
        if eq_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_equipment 
                    ("CodEqu", "Descri", "precio", "deprec_factor", "CosDia", "ref_code")
                    VALUES (:CodEqu, :Descri, :precio, :deprec_factor, :CosDia, :ref_code)
                    ON CONFLICT ("CodEqu") DO NOTHING
                """),
                eq_batch
            )
            counts["equipment"] += len(eq_batch)

        # 4. Mano de Obra
        raw_lab = tables.get("manodeobra", [])
        lab_batch = []
        seen_lab = set()
        for r in raw_lab:
            ref = _clean_str(r.get("Referencia"))
            if not ref or ref in seen_lab:
                continue
            seen_lab.add(ref)
            desc = _clean_str(r.get("Descripcion")) or ref
            jornal = _parse_float(r.get("PrecioDollar") or r.get("Jornal"), default=0.0)
            bono = _parse_float(r.get("ValorAgregado") or r.get("Bono"), default=0.0)
            if ref in zonas_lab:
                z_j, z_b = zonas_lab[ref]
                if z_j > 0:
                    jornal = z_j
                if z_b >= 0:
                    bono = z_b
            fam = _clean_str(r.get("ReferenciaAgrupacion")) or None
            lab_batch.append({
                "CodMan": ref,
                "Descri": desc,
                "Jornal": jornal,
                "Bono": bono,
                "ref_code": fam
            })
            if len(lab_batch) >= 1000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_labor 
                        ("CodMan", "Descri", "Jornal", "Bono", "ref_code")
                        VALUES (:CodMan, :Descri, :Jornal, :Bono, :ref_code)
                        ON CONFLICT ("CodMan") DO NOTHING
                    """),
                    lab_batch
                )
                counts["labor"] += len(lab_batch)
                lab_batch = []
        if lab_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_labor 
                    ("CodMan", "Descri", "Jornal", "Bono", "ref_code")
                    VALUES (:CodMan, :Descri, :Jornal, :Bono, :ref_code)
                    ON CONFLICT ("CodMan") DO NOTHING
                """),
                lab_batch
            )
            counts["labor"] += len(lab_batch)

        # 5. Recetas APU Materiales
        raw_apumat = tables.get("partidasmateriales", [])
        apumat_batch = []
        seen_apumat = set()
        for r in raw_apumat:
            par = _clean_str(r.get("ReferenciaPartida"))
            ins = _clean_str(r.get("ReferenciaMaterial"))
            if not par or not ins or (par, ins) in seen_apumat:
                continue
            seen_apumat.add((par, ins))
            can = _parse_float(r.get("Cantidad"), default=0.0)
            desp = _parse_float(r.get("Desperdicio"), default=0.0)
            apumat_batch.append({"CodPar": par, "CodIns": ins, "CanIns": can, "Desper": desp})
            if len(apumat_batch) >= 2000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_apu_materials ("CodPar", "CodIns", "CanIns", "Desper")
                        VALUES (:CodPar, :CodIns, :CanIns, :Desper)
                        ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                    """),
                    apumat_batch
                )
                counts["apu_materials"] += len(apumat_batch)
                apumat_batch = []
        if apumat_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_apu_materials ("CodPar", "CodIns", "CanIns", "Desper")
                    VALUES (:CodPar, :CodIns, :CanIns, :Desper)
                    ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                """),
                apumat_batch
            )
            counts["apu_materials"] += len(apumat_batch)

        # 6. Recetas APU Equipos
        raw_apueq = tables.get("partidasequipos", [])
        apueq_batch = []
        seen_apueq = set()
        for r in raw_apueq:
            par = _clean_str(r.get("ReferenciaPartida"))
            ins = _clean_str(r.get("ReferenciaEquipo"))
            if not par or not ins or (par, ins) in seen_apueq:
                continue
            seen_apueq.add((par, ins))
            can = _parse_float(r.get("Cantidad"), default=0.0)
            dep = _parse_float(r.get("Depreciacion"), default=1.0)
            apueq_batch.append({"CodPar": par, "CodIns": ins, "CanIns": can, "Deprec": dep})
            if len(apueq_batch) >= 2000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_apu_equipment ("CodPar", "CodIns", "CanIns", "Deprec")
                        VALUES (:CodPar, :CodIns, :CanIns, :Deprec)
                        ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                    """),
                    apueq_batch
                )
                counts["apu_equipment"] += len(apueq_batch)
                apueq_batch = []
        if apueq_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_apu_equipment ("CodPar", "CodIns", "CanIns", "Deprec")
                    VALUES (:CodPar, :CodIns, :CanIns, :Deprec)
                    ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                """),
                apueq_batch
            )
            counts["apu_equipment"] += len(apueq_batch)

        # 7. Recetas APU Mano de Obra
        raw_apulab = tables.get("partidasmanodeobra", [])
        apulab_batch = []
        seen_apulab = set()
        for r in raw_apulab:
            par = _clean_str(r.get("ReferenciaPartida"))
            ins = _clean_str(r.get("ReferenciaManodeObra"))
            if not par or not ins or (par, ins) in seen_apulab:
                continue
            seen_apulab.add((par, ins))
            can = _parse_float(r.get("Cantidad"), default=0.0)
            apulab_batch.append({"CodPar": par, "CodIns": ins, "CanIns": can})
            if len(apulab_batch) >= 2000:
                db.execute(
                    text(f"""
                        INSERT INTO "{schema_name}".cost360_apu_labor ("CodPar", "CodIns", "CanIns")
                        VALUES (:CodPar, :CodIns, :CanIns)
                        ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                    """),
                    apulab_batch
                )
                counts["apu_labor"] += len(apulab_batch)
                apulab_batch = []
        if apulab_batch:
            db.execute(
                text(f"""
                    INSERT INTO "{schema_name}".cost360_apu_labor ("CodPar", "CodIns", "CanIns")
                    VALUES (:CodPar, :CodIns, :CanIns)
                    ON CONFLICT ("CodPar", "CodIns") DO NOTHING
                """),
                apulab_batch
            )
            counts["apu_labor"] += len(apulab_batch)

    return counts


def create_costbase_from_tables(
    db: Session,
    tables: Dict[str, List[Dict[str, str]]],
    name: str,
    description: Optional[str],
    user_email: str,
    is_published: bool = True,
) -> Dict[str, Any]:
    """Crea una base de datos completa e independiente en PostgreSQL a partir de tablas parseadas."""
    if not name or not name.strip():
        raise MdbDatabaseImportError("El nombre de la base de datos es obligatorio.")

    schema_name = _generate_clean_schema_id(db, name.strip())
    logger.info("[MDB_DB_IMPORT] Creando base de datos '%s' en esquema '%s'", name, schema_name)

    try:
        # 1. Crear esquema y tablas
        create_costbase_schema_tables(db, schema_name)

        # 2. Poblar datos
        counts = _populate_from_tables(db, schema_name, tables)

        # 3. Crear índices
        create_costbase_schema_indexes(db, schema_name)

        # 4. Registrar en cost360_databases
        clean_desc = (description or f"Base de datos importada desde Maprex Access. Creada por {user_email}").strip()
        now = datetime.now(timezone.utc)
        record = Cost360Database(
            id=schema_name,
            name=name.strip(),
            description=clean_desc,
            is_master=False,
            is_active=True,
            material_inflation=0.0,
            labor_inflation=0.0,
            equipment_inflation=0.0,
            source_database_id="maprex_import",
            created_by=user_email,
            owner_id=user_email,
            is_published=is_published,
            published_at=now if is_published else None,
        )
        db.add(record)
        db.commit()

        logger.info(
            "[MDB_DB_IMPORT] Éxito: base '%s' (schema: %s) creada con %d partidas y %d materiales",
            name, schema_name, counts["items"], counts["materials"]
        )

        return {
            "status": "success",
            "message": f"Base de datos '{name}' creada exitosamente",
            "database": {
                "id": schema_name,
                "name": name.strip(),
                "description": clean_desc,
                "is_published": is_published,
                "created_by": user_email,
                "created_at": now.isoformat(),
            },
            "counts": counts,
        }

    except Exception as exc:
        db.rollback()
        logger.error("[MDB_DB_IMPORT] Falló la importación en esquema %s: %s", schema_name, exc, exc_info=True)
        # Limpieza física del esquema huérfano
        try:
            db.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE;'))
            db.commit()
        except Exception as drop_err:
            logger.error("[MDB_DB_IMPORT] Error limpiando esquema %s: %s", schema_name, drop_err, exc_info=True)
            db.rollback()
        raise MdbDatabaseImportError(f"Error al estructurar la base de datos: {str(exc)}") from exc


def create_costbase_from_mdb(
    db: Session,
    mdb_path: str,
    name: str,
    description: Optional[str],
    user_email: str,
    is_published: bool = True,
) -> Dict[str, Any]:
    """Crea una base de datos leyendo directamente un archivo .mdb/.accdb con mdbtools."""
    tables = _read_mdb_raw_tables(mdb_path)
    return create_costbase_from_tables(
        db=db,
        tables=tables,
        name=name,
        description=description,
        user_email=user_email,
        is_published=is_published,
    )


def create_costbase_from_csv_zip(
    db: Session,
    zip_path: str,
    name: str,
    description: Optional[str],
    user_email: str,
    is_published: bool = True,
) -> Dict[str, Any]:
    """Crea una base de datos leyendo un archivo ZIP que contiene los CSVs de Maprex."""
    tables = _read_zip_raw_tables(zip_path)
    return create_costbase_from_tables(
        db=db,
        tables=tables,
        name=name,
        description=description,
        user_email=user_email,
        is_published=is_published,
    )
