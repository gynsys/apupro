import io
import re
from typing import Any, Dict, List, Optional, Tuple
import openpyxl
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.base import get_db
from app.api.v1.endpoints.costbase.common import (
    RESOURCE_CONFIG,
    clean_cell_str,
    set_schema_for_db
)

router = APIRouter()


def execute_bulk_resource_updates(
    db: Session,
    table_name: str,
    id_col: str,
    price_col: str,
    res_key: str,
    item_label: str,
    codigos_precio: Dict[str, float],
    batch_size: int = 500,
) -> Tuple[int, List[str]]:
    """
    Ejecuta actualizaciones masivas de precios de manera ultra-rápida y a prueba de fallos.
    Utiliza lotes SQL con cláusula VALUES para actualizar cientos de registros por consulta.
    Si algún lote llegara a tener un error de sintaxis/dato, utiliza savepoints (begin_nested)
    para aislarlo fila por fila y garantizar que todos los demás registros válidos continúen.
    """
    if not codigos_precio:
        return 0, []

    updated_count = 0
    errors: List[str] = []
    items_list = list(codigos_precio.items())

    for i in range(0, len(items_list), batch_size):
        chunk = items_list[i:i + batch_size]
        values_parts: List[str] = []
        for cod, pr in chunk:
            safe_cod = cod.replace("'", "''").strip()
            values_parts.append(f"('{safe_cod}', {float(pr)}::double precision)")

        values_sql = ", ".join(values_parts)

        # Para equipos, además de CosDia actualizamos el campo 'precio' si existe
        extra_set = ""
        if res_key in ("equipments", "equipment", "equipos"):
            extra_set = f', "precio" = CASE WHEN t."deprec_factor" IS NOT NULL AND t."deprec_factor" > 0 AND t."deprec_factor" < 1.0 THEN v.precio / t."deprec_factor" ELSE v.precio END'

        batch_query = text(f"""
            UPDATE {table_name} AS t
            SET "{price_col}" = v.precio {extra_set}
            FROM (VALUES {values_sql}) AS v(codigo, precio)
            WHERE (UPPER(TRIM(t."{id_col}")) = UPPER(TRIM(v.codigo))
               OR (t.ref_code IS NOT NULL AND UPPER(TRIM(t.ref_code)) = UPPER(TRIM(v.codigo))))
        """)

        try:
            with db.begin_nested():
                res = db.execute(batch_query)
                updated_count += res.rowcount
        except Exception as e_batch:
            logger.warning(f"Lote {i}-{i+len(chunk)} ejecutando fallback individual de precios: {e_batch}")
            q_single = text(f"""
                UPDATE {table_name}
                SET "{price_col}" = :p {extra_set}
                WHERE (UPPER(TRIM("{id_col}")) = UPPER(TRIM(:c))
                   OR (ref_code IS NOT NULL AND UPPER(TRIM(ref_code)) = UPPER(TRIM(:c))))
            """)
            for cod, pr in chunk:
                try:
                    with db.begin_nested():
                        r = db.execute(q_single, {"p": float(pr), "c": cod})
                        if r.rowcount > 0:
                            updated_count += r.rowcount
                        else:
                            errors.append(f"{item_label} {cod} no encontrado")
                except Exception as e_indiv:
                    logger.error(f"Error actualizando {item_label} {cod}: {e_indiv}", exc_info=True)
                    errors.append(f"Error con {cod}: {str(e_indiv)}")

    db.commit()
    return updated_count, errors


@router.post("/materials/bulk-update")
@router.post("/{resource_type}/bulk-update")
def bulk_update_resources(
    resource_type: str = "materials",
    payload: Optional[Dict[str, Any]] = None,
    database_id: Optional[str] = "master",
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Actualización masiva de precios para materiales, equipos o mano de obra.
    Actualización directa en base de datos para máxima eficiencia sin consumo de tokens IA.
    """
    if payload is None:
        payload = {}

    res_key = resource_type.lower().strip()
    if res_key not in RESOURCE_CONFIG:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de recurso inválido: '{resource_type}'. Válidos: materiales, equipos, mano de obra."
        )

    config = RESOURCE_CONFIG[res_key]
    table_name = config["table"]
    id_col = config["id_col"]
    price_col = config["price_col"]
    item_label = config["name"]

    if database_id and database_id != "master":
        set_schema_for_db(db, database_id)

    try:
        updates = payload.get("updates", [])
        if not updates:
            return {"updated": 0, "errors": [], "total": 0}

        errors: List[str] = []
        codigos_precio: Dict[str, float] = {}

        for update in updates:
            if not isinstance(update, dict):
                continue
            codigo = clean_cell_str(update.get("codigo", "")).strip().strip('"\'')
            precio_raw = update.get("precio")
            if codigo and precio_raw is not None:
                try:
                    if isinstance(precio_raw, (int, float)):
                        codigos_precio[codigo] = float(precio_raw)
                    elif isinstance(precio_raw, str):
                        clean_p = re.sub(r"[^\d,\.]", "", precio_raw.strip())
                        if "." in clean_p and "," in clean_p:
                            if clean_p.rfind(",") > clean_p.rfind("."):
                                clean_p = clean_p.replace(".", "").replace(",", ".")
                            else:
                                clean_p = clean_p.replace(",", "")
                        elif "," in clean_p:
                            clean_p = clean_p.replace(",", ".")
                        codigos_precio[codigo] = float(clean_p)
                    else:
                        codigos_precio[codigo] = float(precio_raw)
                except (ValueError, TypeError):
                    errors.append(f"Precio inválido para código {codigo}: {precio_raw}")

        updated_count, db_errors = execute_bulk_resource_updates(
            db=db,
            table_name=table_name,
            id_col=id_col,
            price_col=price_col,
            res_key=res_key,
            item_label=item_label,
            codigos_precio=codigos_precio,
        )
        errors.extend(db_errors)

        return {
            "updated": updated_count,
            "errors": errors,
            "total": len(updates)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error en actualización masiva de precios ({resource_type}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en actualización masiva: {str(e)}")


@router.post("/materials/bulk-update-excel")
@router.post("/{resource_type}/bulk-update-excel")
async def bulk_update_prices_excel_route(
    resource_type: str = "materials",
    file: UploadFile = File(...),
    database_id: Optional[str] = "master",
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Actualización masiva de precios desde archivo Excel (.xlsx o .xls) o CSV de un solo golpe.
    Formato esperado: columnas de 'Código' y 'Precio' (o 'Costo', 'Jornal', etc.).
    Aplica a materiales, equipos o mano de obra según resource_type.
    """
    res_key = resource_type.lower().strip()
    if res_key not in RESOURCE_CONFIG:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de recurso inválido: '{resource_type}'. Válidos: materiales, equipos, mano de obra."
        )

    config = RESOURCE_CONFIG[res_key]
    table_name = config["table"]
    id_col = config["id_col"]
    price_col = config["price_col"]
    item_label = config["name"]

    if database_id and database_id != "master":
        set_schema_for_db(db, database_id)

    try:
        contents = await file.read()
        rows: List[List[Any]] = []
        try:
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            ws = wb.active
            rows = [list(r) for r in ws.iter_rows(values_only=True)]
        except Exception as e_xl:
            try:
                df = pd.read_excel(io.BytesIO(contents))
                header = list(df.columns)
                data_rows = df.values.tolist()
                rows = [header] + data_rows
            except Exception as e_pd:
                try:
                    df = pd.read_csv(io.BytesIO(contents), sep=None, engine="python")
                    header = list(df.columns)
                    data_rows = df.values.tolist()
                    rows = [header] + data_rows
                except Exception as e_csv:
                    logger.error(f"Error leyendo archivo de precios: {e_xl} | {e_pd} | {e_csv}", exc_info=True)
                    raise HTTPException(
                        status_code=400,
                        detail="No se pudo leer el archivo. Asegúrese de que sea un archivo Excel válido (.xlsx o .xls) o CSV."
                    )

        if not rows or len(rows) < 2:
            return {"updated": 0, "errors": ["El archivo está vacío o no contiene filas de datos"], "total": 0}

        codigo_col_idx: Optional[int] = None
        precio_col_idx: Optional[int] = None
        header_row_idx = 0

        # Escanear las primeras 25 filas para detectar la fila de encabezados real
        for r_idx in range(min(len(rows), 25)):
            r = rows[r_idx]
            c_idx = None
            p_idx = None
            for idx, header in enumerate(r):
                if header is None:
                    continue
                h_norm = str(header).lower().strip()
                h_clean = h_norm.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
                if c_idx is None and any(k in h_clean for k in ["codigo", "codmat", "codequ", "codman", "cod.", "cod_", "código", "ref_code", "referencia"]):
                    c_idx = idx
                elif p_idx is None and any(k in h_clean for k in ["precio", "costo", "cosmat", "jornal", "cosdia", "monto", "valor", "p.u", "pu", "tarifa", "salario"]):
                    p_idx = idx
            if c_idx is not None:
                codigo_col_idx = c_idx
                header_row_idx = r_idx
                if p_idx is not None:
                    precio_col_idx = p_idx
                    break

        # Si encontramos columna de código pero ninguna columna decía "precio"
        if codigo_col_idx is not None and precio_col_idx is None:
            for col_cand in range(len(rows[header_row_idx])):
                if col_cand == codigo_col_idx:
                    continue
                num_matches = 0
                for sample_r in rows[header_row_idx + 1:header_row_idx + 15]:
                    if len(sample_r) > col_cand and sample_r[col_cand] is not None:
                        val_str = re.sub(r"[^\d,\.]", "", str(sample_r[col_cand]).strip())
                        if val_str and any(ch.isdigit() for ch in val_str):
                            num_matches += 1
                if num_matches >= 3:
                    precio_col_idx = col_cand
                    break

        # Fallback si no hubo coincidencia por palabras clave
        if codigo_col_idx is None or precio_col_idx is None:
            for r_idx in range(min(len(rows), 15)):
                r = rows[r_idx]
                if len(r) >= 2 and r[0] is not None:
                    test_str = str(r[1] if len(r) > 1 else r[-1]).strip()
                    clean_test = re.sub(r"[^\d,\.]", "", test_str)
                    if clean_test and any(ch.isdigit() for ch in clean_test):
                        codigo_col_idx = 0
                        precio_col_idx = 1
                        header_row_idx = r_idx - 1
                        break
            if codigo_col_idx is None or precio_col_idx is None:
                if len(rows[0]) >= 2:
                    codigo_col_idx = 0
                    precio_col_idx = 1
                    header_row_idx = 0
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="No se encontraron columnas de Código y Precio en el archivo Excel."
                    )

        errors: List[str] = []
        codigos_precio: Dict[str, float] = {}

        for row in rows[header_row_idx + 1:]:
            if len(row) <= max(codigo_col_idx, precio_col_idx):
                continue

            raw_c = row[codigo_col_idx]
            if raw_c is None:
                continue

            codigo = clean_cell_str(raw_c).strip().strip('"\'')
            precio_raw = row[precio_col_idx]

            if not codigo or precio_raw is None:
                continue

            precio_val: Optional[float] = None
            if isinstance(precio_raw, (int, float)):
                precio_val = float(precio_raw)
            elif isinstance(precio_raw, str):
                clean_p = re.sub(r"[^\d,\.]", "", precio_raw.strip())
                if clean_p:
                    if "." in clean_p and "," in clean_p:
                        if clean_p.rfind(",") > clean_p.rfind("."):
                            clean_p = clean_p.replace(".", "").replace(",", ".")
                        else:
                            clean_p = clean_p.replace(",", "")
                    elif "," in clean_p:
                        clean_p = clean_p.replace(",", ".")
                    try:
                        precio_val = float(clean_p)
                    except ValueError:
                        errors.append(f"Precio inválido para código {codigo}: {precio_raw}")
            if precio_val is not None:
                codigos_precio[codigo] = precio_val

        if not codigos_precio:
            return {"updated": 0, "errors": ["No se detectaron códigos y precios válidos en el archivo"], "total": 0}

        updated_count, db_errors = execute_bulk_resource_updates(
            db=db,
            table_name=table_name,
            id_col=id_col,
            price_col=price_col,
            res_key=res_key,
            item_label=item_label,
            codigos_precio=codigos_precio,
        )
        errors.extend(db_errors)

        return {
            "updated": updated_count,
            "errors": errors,
            "total": len(codigos_precio),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error en actualización masiva de precios por Excel ({resource_type}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en actualización masiva por Excel: {str(e)}")


@router.post("/materials/bulk-update-descriptions")
@router.post("/{resource_type}/bulk-update-descriptions")
async def bulk_update_descriptions_route(
    resource_type: str = "materials",
    file: UploadFile = File(...),
    database_id: Optional[str] = "master",
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Actualización masiva de descripciones desde archivo Excel (.xlsx o .xls).
    Formato esperado: columnas 'Código' y 'Descripción'.
    Aplica a materiales, equipos o mano de obra según resource_type.
    """
    res_key = resource_type.lower().strip()
    if res_key not in RESOURCE_CONFIG:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de recurso inválido: '{resource_type}'. Válidos: materiales, equipos, mano de obra."
        )

    config = RESOURCE_CONFIG[res_key]
    table_name = config["table"]
    id_col = config["id_col"]
    desc_col = config["desc_col"]
    item_label = config["name"]

    if database_id and database_id != "master":
        set_schema_for_db(db, database_id)

    try:
        contents = await file.read()
        rows: List[List[Any]] = []
        try:
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            ws = wb.active
            rows = [list(r) for r in ws.iter_rows(values_only=True)]
        except Exception as e_xl:
            try:
                df = pd.read_excel(io.BytesIO(contents))
                header = list(df.columns)
                data_rows = df.values.tolist()
                rows = [header] + data_rows
            except Exception as e_pd:
                logger.error(f"Error leyendo archivo Excel: {e_xl} | Fallback pandas: {e_pd}", exc_info=True)
                raise HTTPException(
                    status_code=400,
                    detail="No se pudo leer el archivo Excel. Asegúrese de que sea un archivo válido (.xlsx o .xls)."
                )

        if not rows or len(rows) < 2:
            return {"updated": 0, "errors": ["El archivo Excel está vacío o no contiene filas de datos"], "total": 0}

        codigo_col_idx: Optional[int] = None
        descripcion_col_idx: Optional[int] = None
        header_row_idx = 0

        # Escanear las primeras 25 filas para detectar la fila de encabezados real
        for r_idx in range(min(len(rows), 25)):
            r = rows[r_idx]
            c_idx = None
            d_idx = None
            for idx, header in enumerate(r):
                if header is None:
                    continue
                h_norm = str(header).lower().strip()
                h_clean = h_norm.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
                if c_idx is None and any(k in h_clean for k in ["codigo", "codmat", "codequ", "codman", "cod.", "cod_", "código", "ref_code", "referencia", "id"]):
                    c_idx = idx
                elif d_idx is None and any(k in h_clean for k in ["descripcion", "descri", "detalle", "nombre", "texto"]):
                    d_idx = idx
            if c_idx is not None and d_idx is not None:
                codigo_col_idx = c_idx
                descripcion_col_idx = d_idx
                header_row_idx = r_idx
                break

        # Fallback si no hubo coincidencia por palabras clave: asumir Columna 0 = Código, Columna 1 = Descripción
        if codigo_col_idx is None or descripcion_col_idx is None:
            if len(rows[0]) >= 2:
                codigo_col_idx = 0
                descripcion_col_idx = 1
                header_row_idx = -1  # Para procesar desde la fila 0
            else:
                raise HTTPException(
                    status_code=400,
                    detail="No se encontraron columnas de Código y Descripción en el archivo Excel."
                )

        updated_count = 0
        errors: List[str] = []
        items_to_update: List[Dict[str, str]] = []

        start_row = header_row_idx + 1 if header_row_idx >= 0 else 0
        for row in rows[start_row:]:
            if len(row) <= max(codigo_col_idx, descripcion_col_idx):
                continue

            codigo = clean_cell_str(row[codigo_col_idx]).strip().strip('"\'')
            descripcion = clean_cell_str(row[descripcion_col_idx]).strip()

            if not codigo or not descripcion:
                continue

            items_to_update.append({"codigo": codigo, "descripcion": descripcion})

        if not items_to_update:
            return {"updated": 0, "errors": ["No se detectaron códigos y descripciones válidas en el archivo"], "total": 0}

        # Ejecución por lotes para máximo rendimiento y tolerancia a fallos
        batch_size = 500
        for i in range(0, len(items_to_update), batch_size):
            chunk = items_to_update[i:i + batch_size]
            values_parts: List[str] = []
            for item in chunk:
                safe_cod = item["codigo"].replace("'", "''").strip()
                safe_desc = item["descripcion"].replace("'", "''").strip()
                values_parts.append(f"('{safe_cod}', '{safe_desc}')")

            values_sql = ", ".join(values_parts)
            batch_query = text(f"""
                UPDATE {table_name} AS t
                SET "{desc_col}" = v.descripcion
                FROM (VALUES {values_sql}) AS v(codigo, descripcion)
                WHERE (UPPER(TRIM(t."{id_col}")) = UPPER(TRIM(v.codigo))
                   OR (t.ref_code IS NOT NULL AND UPPER(TRIM(t.ref_code)) = UPPER(TRIM(v.codigo))))
            """)
            try:
                with db.begin_nested():
                    res = db.execute(batch_query)
                    updated_count += res.rowcount
            except Exception as e_batch:
                logger.warning(f"Lote {i}-{i+len(chunk)} ejecutando fallback individual de descripciones: {e_batch}")
                q_single = text(f"""
                    UPDATE {table_name}
                    SET "{desc_col}" = :d
                    WHERE (UPPER(TRIM("{id_col}")) = UPPER(TRIM(:c))
                       OR (ref_code IS NOT NULL AND UPPER(TRIM(ref_code)) = UPPER(TRIM(:c))))
                """)
                for item in chunk:
                    try:
                        with db.begin_nested():
                            r = db.execute(q_single, {"d": item["descripcion"], "c": item["codigo"]})
                            if r.rowcount > 0:
                                updated_count += r.rowcount
                            else:
                                errors.append(f"{item_label} {item['codigo']} no encontrado")
                    except Exception as e_indiv:
                        errors.append(f"Error actualizando {item['codigo']}: {str(e_indiv)}")

        db.commit()

        return {
            "updated": updated_count,
            "errors": errors,
            "total": len(items_to_update),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error en actualización masiva de descripciones ({resource_type}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en actualización masiva de descripciones: {str(e)}")
