import io
import json
import logging
import os
import re
import tempfile
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
import fitz  # PyMuPDF
import google.generativeai as genai
try:
    from markitdown import MarkItDown
except ImportError:
    MarkItDown = None  # type: ignore[assignment]
import PIL.Image
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.endpoints.costbase import set_schema_for_db
from app.core.config import settings
from app.crud.llm import decrypt_api_key
from app.db.base import get_db
from app.db.models.cost360 import CostMaterial, MaterialSynonym
from app.services.currency_service import get_bcv_rate
from app.services.llm_router import call_llm_json

router = APIRouter()
logger = logging.getLogger(__name__)


class ApproveItem(BaseModel):
    original_desc: str
    matched_codmat: str
    new_price: float


class ApproveQuoteRequest(BaseModel):
    items: List[ApproveItem]
    database_id: Optional[str] = "master"


class ReferenceUpdateItem(BaseModel):
    codmat: str
    new_price: float
    vendor: Optional[str] = None
    original_desc: Optional[str] = None


class BatchReferenceUpdateRequest(BaseModel):
    items: List[ReferenceUpdateItem]
    database_id: Optional[str] = "master"


REFERENCE_MATERIALS_DEF: List[Dict[str, Any]] = [
    { "codmat": "ELE128", "name": "CABLE THW 12 AWG COBRE (0,050 KG/M)", "unit": "m", "vendor": "Pall Ferretería", "family_id": "FAM-18E7577F", "vendor_codes": [] },
    { "codmat": "PLOA83", "name": "CANILLA FLEXIBLE ACERO INOX. 1/2\" X 5/8\"", "unit": "pza", "vendor": "Pall Ferretería", "family_id": "FAM-B1D67CE6", "vendor_codes": [] },
    { "codmat": "ACE019", "name": "CABILLA* D=3/8\" FY=4200 KGF/CM2 0,559 K", "unit": "kgf", "vendor": "Pall Ferretería", "family_id": "FAM-1E916DC4", "vendor_codes": ["CONST0035"] },
    { "codmat": "MT3029", "name": "RAMPLUG PLASTICO 5/16\" COLOR AZUL", "unit": "pza", "vendor": "Pall Ferretería", "family_id": "FAM-E914CF58", "vendor_codes": [] },
    { "codmat": "MAT-80EE53", "name": "BLOQUE PARED ENTERO NORMAL CONCRETO 15X20X40 CM.", "unit": "PZA", "vendor": "Pall Ferretería", "family_id": "FAM-FAE5C031", "vendor_codes": [] },
    { "codmat": "MAT-179B0B", "name": "PINTURA ALUMINIO", "unit": "gal", "vendor": "Pall Ferretería", "family_id": "FAM-633C4CDE", "vendor_codes": [] },
    { "codmat": "PLO915", "name": "LLAVE DE ARRESTO PARA PIEZAS SANITARIAS", "unit": "pza", "vendor": "Pall Ferretería", "family_id": "FAM-9F8CC197", "vendor_codes": [] },
    { "codmat": "ACA075", "name": "DISCO ABRASIVO PARA ESMERIL 7\"", "unit": "pza", "vendor": "Pall Ferretería", "family_id": "FAM-4EEF21F9", "vendor_codes": [] },
    { "codmat": "ACA015", "name": "RAMPLUG PLÁSTICO 1/4\" COLOR VERDE", "unit": "pza", "vendor": "Pall Ferretería", "family_id": "FAM-A4C7539E", "vendor_codes": [] },
    { "codmat": "ELE347", "name": "LÁMPARA DE EMERGENCIA EN CAJA PLÁSTICA CON 2 FAROS DIRECCIONALES", "unit": "pza", "vendor": "Pall Ferretería", "family_id": "FAM-D97847CD", "vendor_codes": [] },
    { "codmat": "PIN034", "name": "PINTURA DE ESMALTE TIPO A #", "unit": "gln", "vendor": "Pall Ferretería", "family_id": "FAM-633C4CDE", "vendor_codes": [] },
    { "codmat": "MAT2318", "name": "SIFON PLASTICO D=1 1/2\" P/BATEA FREGADERO", "unit": "pieza", "vendor": "Pall Ferretería", "family_id": "FAM-3C9FDDC7", "vendor_codes": [] },
    { "codmat": "ASF119", "name": "CEMENTO PLÁSTICO (ASFALTO) IPA 5 GALONES O SIMILAR", "unit": "cuñ", "vendor": "Pall Ferretería", "family_id": "FAM-D07354C8", "vendor_codes": [] },
    { "codmat": "ARC078", "name": "BLOQUE DE ARCILLA PARA PLATABANDA 15 X 20 X 40 CM (8 UNIDADES / M2)", "unit": "pza", "vendor": "Pall Ferretería", "family_id": "FAM-7C69BC65", "vendor_codes": [] },
    { "codmat": "AGR018", "name": "ARENA LAVADA", "unit": "m3", "vendor": "Pall Ferretería", "family_id": "FAM-E96F7D07", "vendor_codes": ["GN11116"] },
    { "codmat": "CEM041", "name": "CEMENTO GRIS PORTLAND SACO DE 42,5 KG", "unit": "sco", "vendor": "Pall Ferretería", "family_id": "FAM-90B54703", "vendor_codes": ["GN15518"] },
    { "codmat": "VID023", "name": "VIDRIO PLANO E=5 MM", "unit": "m2", "vendor": "Pall Ferretería", "family_id": "FAM-C005F7AF", "vendor_codes": [] },
    { "codmat": "MT558", "name": "TIERRA NEGRA ABONADA / JARDINERIA", "unit": "m3", "vendor": "Pall Ferretería", "family_id": "FAM-E181000F", "vendor_codes": [] },
    { "codmat": "ENC001", "name": "CUARTON DE MADERA AURORA 5 X 10 CM X L=3", "unit": "m3", "vendor": "Pall Ferretería", "family_id": "FAM-C2645CBB", "vendor_codes": [] },
    { "codmat": "ACA014", "name": "LÁMINA DE YESO 4' X 8' X 1/2\" (1,2 X 2,4 M)", "unit": "m2", "vendor": "Matos Suplidores", "family_id": "FAM-DRYWALL", "vendor_codes": ["CRY226"] },
    { "codmat": "APA025", "name": "MANOMETRO RANGO 0-200 PSI", "unit": "und", "vendor": "Pall Ferretería", "family_id": "FAM-15781C45", "vendor_codes": [] },
    { "codmat": "MEC348", "name": "FORMULA MECANICA EN SPRAY / ACEITE LUBRI", "unit": "env", "vendor": "Pall Ferretería", "family_id": "FAM-4295CE6B", "vendor_codes": [] },
    { "codmat": "MAT3160", "name": "VARILLAS DE PLATA AL 5% P/REFRIGERACION", "unit": "pieza", "vendor": "Pall Ferretería", "family_id": "FAM-38241F3B", "vendor_codes": [] },
    { "codmat": "MAT1623", "name": "LAMINA DE POLIESTIRENO 1,20X0,60M E= 5/8\"", "unit": "pieza", "vendor": "Matos Suplidores", "family_id": "FAM-ANIME", "vendor_codes": ["CRY211"] }
]


def _parse_currency_num(val_str: str) -> Optional[float]:
    val_str = val_str.strip().replace('$', '').replace('Bs', '').strip()
    if not val_str:
        return None
    if ',' in val_str and '.' in val_str:
        if val_str.rfind('.') > val_str.rfind(','):
            val_str = val_str.replace(',', '')
        else:
            val_str = val_str.replace('.', '').replace(',', '.')
    elif ',' in val_str:
        val_str = val_str.replace(',', '.')
    try:
        n = float(val_str)
        return n if n > 0 else None
    except Exception:
        return None


def deterministic_extract_targets(raw_text: str, targets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extracción directa determinística utilizando los códigos de catálogo de los proveedores
    conocidos (Pall y Matos) y patrones sobre el texto estructurado del documento sin requerir LLM.
    """
    found: List[Dict[str, Any]] = []
    found_codmats = set()
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]

    # 1. Búsqueda directa para Matos Suplidores (CRY226 y CRY211)
    for i, line in enumerate(lines):
        line_upper = line.upper()
        # Lámina de yeso Knauf (ACA014): CRY226 o "LAMINA ... KNAUF"
        if ("ACA014" not in found_codmats) and (
            line == "CRY226" 
            or ("CRY226" in line_upper)
            or ("LAMINA" in line_upper and "KNAUF" in line_upper)
            or ("LAMINA" in line_upper and "1,22" in line_upper and "2,44" in line_upper)
        ):
            window = lines[i:min(len(lines), i + 10)]
            nums = [_parse_currency_num(x) for x in window if _parse_currency_num(x) is not None]
            unit_price = None
            if len(lines) > i + 5 and _parse_currency_num(lines[i + 5]):
                unit_price = _parse_currency_num(lines[i + 5])
            elif nums:
                unit_price = nums[-2] if len(nums) >= 2 else nums[0]

            if unit_price and unit_price > 0:
                # 1 lámina = 1.22 x 2.44 = 2.9768 m2. En APU la unidad es m2.
                price_m2 = round(unit_price / 2.9768, 4)
                desc = f'LAMINA KNAUF 1.22x2.44 ({unit_price:,.2f} Bs / 2.977 m2 = {price_m2:,.2f} Bs/m2)'
                found.append({
                    "codmat": "ACA014",
                    "descripcion_cotizada": desc,
                    "precio_cotizado": price_m2,
                    "unidad_cotizada": "m2"
                })
                found_codmats.add("ACA014")

        # Yeso pintado / Anime (MAT1623): CRY211 o "YESO PINTADO LISO"
        if ("MAT1623" not in found_codmats) and (
            line == "CRY211"
            or ("CRY211" in line_upper)
            or ("YESO PINTADO" in line_upper and "1.20" in line_upper)
        ):
            window = lines[i:min(len(lines), i + 10)]
            nums = [_parse_currency_num(x) for x in window if _parse_currency_num(x) is not None]
            unit_price = None
            if len(lines) > i + 5 and _parse_currency_num(lines[i + 5]):
                unit_price = _parse_currency_num(lines[i + 5])
            elif nums:
                unit_price = nums[-2] if len(nums) >= 2 else nums[0]

            if unit_price and unit_price > 0:
                # La cotización de Matos ya viene expresada por lámina individual (unidad: LAM)
                price_pza = round(unit_price, 4)
                desc = f'YESO PINTADO 1.20x0.60 ({unit_price:,.2f} Bs / lámina)'
                found.append({
                    "codmat": "MAT1623",
                    "descripcion_cotizada": desc,
                    "precio_cotizado": price_pza,
                    "unidad_cotizada": "pieza"
                })
                found_codmats.add("MAT1623")

    # 2. Búsqueda para Pall Ferretería y otros insumos por códigos de catálogo de proveedor
    pall_units = {"SCO", "MT3", "UND", "PZA", "KGR", "CUÑ", "RLL", "GLN", "MTR", "KG"}
    for target in targets:
        codmat = target["codmat"]
        if codmat in found_codmats:
            continue
        vendor_codes = target.get("vendor_codes", [])

        for vcode in vendor_codes:
            if not vcode or codmat in found_codmats:
                continue
            for i, line in enumerate(lines):
                if vcode in line:
                    window = lines[i:min(len(lines), i + 8)]
                    unit_price = None

                    # Buscar inmediatamente tras la unidad de empaque (formato estándar Pall)
                    for j, w in enumerate(window):
                        if w.upper() in pall_units and j + 1 < len(window):
                            cand = _parse_currency_num(window[j + 1])
                            if cand is not None:
                                unit_price = cand
                                break

                    # Si el precio estaba en la misma línea
                    if not unit_price:
                        nums_inline = re.findall(r"\b\d+(?:[\.,]\d{2,4})\b", line)
                        if nums_inline:
                            unit_price = _parse_currency_num(nums_inline[-2] if len(nums_inline) >= 2 else nums_inline[0])

                    # O en las líneas inmediatas de la ventana
                    if not unit_price:
                        for w in window[1:]:
                            parsed = _parse_currency_num(w)
                            if parsed is not None:
                                unit_price = parsed
                                break

                    if unit_price and unit_price > 0:
                        desc_text = f"{vcode} - {target['name']}"
                        price_val = unit_price

                        # Conversión cabilla 3/8" (6m -> kgf)
                        if codmat == "ACE019" and vcode == "CONST0035":
                            orig_bar = unit_price
                            price_val = round(orig_bar / 3.354, 4)
                            desc_text = f"CABILLA 3/8\" 6M (Barra: ${orig_bar:.2f} / 3.354 kg = ${price_val:.3f}/kgf)"

                        found.append({
                            "codmat": codmat,
                            "descripcion_cotizada": desc_text,
                            "precio_cotizado": price_val,
                            "unidad_cotizada": target.get("unit", "")
                        })
                        found_codmats.add(codmat)
                        break

    return found


def lexical_search_materials(db: Session, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    words = [w for w in query.split() if len(w) > 2]
    if not words:
        return []
    tsquery_str = " | ".join(words)
    sql = text('''
        SELECT "CodMat", "Descri", "CosMat", "UniMat",
               ts_rank(to_tsvector('spanish', "Descri"), to_tsquery('spanish', :tsquery)) as rank
        FROM cost360_materials
        WHERE to_tsvector('spanish', "Descri") @@ to_tsquery('spanish', :tsquery)
        ORDER BY rank DESC
        LIMIT :limit
    ''')
    results = db.execute(sql, {"tsquery": tsquery_str, "limit": limit}).fetchall()
    return [{"id": r.CodMat, "desc": r.Descri, "current_price": r.CosMat, "db_unit": r.UniMat} for r in results]


@router.post('/analyze-quote')
async def analyze_quote(
    file: UploadFile = File(...),
    database_id: Optional[str] = "master",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    if database_id and database_id != "master":
        set_schema_for_db(db, database_id)
    file_bytes = await file.read()
    raw_text = ""
    
    # 1. Extracción de Texto (Zero-DB)
    if file.filename.lower().endswith('.pdf'):
        try:
            doc = fitz.open(stream=file_bytes, filetype='pdf')
            for page in doc:
                raw_text += page.get_text() + "\\n"
            
            # Si el PDF era escaneado (sin texto) usamos Gemini Vision como OCR
            if len(raw_text.strip()) < 50:
                provider = db.query(LLMProvider).filter(LLMProvider.provider_key == 'gemini').first()
                if provider:
                    genai.configure(api_key=decrypt_api_key(provider.api_key_enc))
                
                raw_text = ""
                images = []
                for page in doc:
                    pix = page.get_pixmap(dpi=150)
                    img = PIL.Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    images.append(img)
                
                if images:
                    model = genai.GenerativeModel('gemini-1.5-flash')
                    prompt_content = images + ["Extrae todo el texto de estas imágenes exactamente como aparece. Solo devuelve el texto plano, sin formato adicional, concatenando todo."]
                    resp = model.generate_content(prompt_content)
                    raw_text = resp.text
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error leyendo PDF: {str(e)}")
    elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        try:
            provider = db.query(LLMProvider).filter(LLMProvider.provider_key == 'gemini').first()
            if provider:
                genai.configure(api_key=decrypt_api_key(provider.api_key_enc))
                
            img = PIL.Image.open(io.BytesIO(file_bytes))
            model = genai.GenerativeModel('gemini-1.5-flash')
            resp = model.generate_content([img, "Extrae todo el texto de esta imagen exactamente como aparece. Solo devuelve el texto plano, sin formato adicional."])
            raw_text = resp.text
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error en OCR con IA: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado.")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No se pudo extraer texto del documento.")

    # 2. Estructuración Inicial (IA Paso 1)
    prompt_paso1 = f'''
Eres un extractor de datos. Extrae todos los insumos y precios del siguiente texto (proveniente de OCR de una cotización).
Ignora basura o ruido del texto. Devuelve un arreglo JSON estricto con este formato:
[{{ "codigo_proveedor": "si aparece", "descripcion": "nombre del material", "unidad_cotizada": "PZA, UND, KG, M2, etc", "precio": 15.5 }}]
Texto OCR:
{raw_text}
'''
    try:
        items_extraidos = call_llm_json(prompt_paso1)
    except Exception as e:
        logger.error(f"Error en Paso 1 (Extracción IA): {e}")
        raise HTTPException(status_code=500, detail="Fallo al estructurar la cotización con IA.")
        
    if isinstance(items_extraidos, dict):
        # Llama 3.2 vision might return the array wrapped in an object like {"items": [...]}
        for key in items_extraidos.keys():
            if isinstance(items_extraidos[key], list):
                items_extraidos = items_extraidos[key]
                break

    # 3. Búsqueda Semántica / Léxica y 4. Emparejamiento Final (IA Paso 2)
    items_para_prompt = []
    items_finales = []
    for idx, item in enumerate(items_extraidos):
        cod_prov = item.get('codigo_proveedor', '')
        desc = item.get('descripcion', '')
        precio = item.get('precio', 0.0)
        unidad_cotizada = item.get('unidad_cotizada', '')
        
        syn_str = f"[{cod_prov}] {desc}" if cod_prov else desc

        # Verificar memoria (sinónimos guardados previamente)
        syn = db.query(MaterialSynonym).filter(MaterialSynonym.provider_text == syn_str).first()
        if syn:
            mat = db.query(CostMaterial).filter(CostMaterial.CodMat == syn.CodMat).first()
            if mat:
                candidatos = [{"id": mat.CodMat, "desc": mat.Descri, "current_price": mat.CosMat, "db_unit": mat.UniMat}]
            else:
                candidatos = lexical_search_materials(db, desc, limit=5)
        else:
            candidatos = lexical_search_materials(db, desc, limit=5)

        items_para_prompt.append({
            "id_temporal": idx,
            "descripcion_cotizada": syn_str,
            "unidad_cotizada": unidad_cotizada,
            "precio_cotizado": precio,
            "candidatos_db": candidatos
        })

    if items_para_prompt:
        prompt_paso2 = f'''
Eres un experto analista de costos. Tienes una lista de ítems extraídos de una cotización y, para cada uno, 5 posibles candidatos de nuestra base de datos.
Selecciona el 'id' (código) del candidato de la base de datos que sea EXACTAMENTE el mismo material cotizado. 
ATENCIÓN A LAS UNIDADES: Si la 'unidad_cotizada' (ej. UND, PZA, Saco) es diferente a la 'db_unit' (ej. KG, M3), DEBES calcular el precio equivalente para la unidad de la base de datos usando tu conocimiento del peso o volumen estándar del material. 
Por ejemplo, si la cotización es por 'PZA' de cabilla de 1/2 y la DB es 'KG', averigua cuánto pesa una cabilla y divide el precio entre el peso.

Devuelve un JSON estrictamente con este formato (un diccionario que mapee el id_temporal a tu resultado):
{{
    "0": {{"id_seleccionado": "código_del_candidato_o_null", "precio_convertido": 12.5, "explicacion": "Se dividió el precio entre 11.9 kg que pesa una cabilla"}},
    "1": {{"id_seleccionado": "código_del_candidato_o_null", "precio_convertido": 15.0, "explicacion": "Misma unidad, no se convirtió"}}
}}

Datos a analizar:
{json.dumps(items_para_prompt, indent=2, ensure_ascii=False)}
'''
        try:
            resultado_final = call_llm_json(prompt_paso2)
        except Exception as e:
            logger.error(f"Error en Paso 2 (Matching IA): {e}")
            raise HTTPException(status_code=500, detail="Fallo al hacer el cruce de materiales con IA.")

        for item in items_para_prompt:
            res_item = resultado_final.get(str(item["id_temporal"])) if isinstance(resultado_final, dict) else None
            
            matched_id = None
            precio_final = item["precio_cotizado"]
            
            if isinstance(res_item, dict):
                matched_id = res_item.get("id_seleccionado")
                precio_convertido = res_item.get("precio_convertido")
                if precio_convertido is not None:
                    try:
                        precio_final = float(precio_convertido)
                    except:
                        pass
            elif isinstance(res_item, str):
                matched_id = res_item
                
            db_price = None
            if matched_id:
                for c in item["candidatos_db"]:
                    if c["id"] == matched_id:
                        db_price = c["current_price"]
                        break
            
            items_finales.append({
                "original_desc": item["descripcion_cotizada"],
                "matched_codmat": matched_id,
                "original_price": item["precio_cotizado"],
                "new_price": precio_final,
                "db_price": db_price
            })

    return {"status": "success", "items": items_finales}

@router.post('/approve-quote')
async def approve_quote(request: ApproveQuoteRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    if request.database_id and request.database_id != "master":
        set_schema_for_db(db, request.database_id)

    updated_count = 0
    for item in request.items:
        if item.matched_codmat:
            mat = db.query(CostMaterial).filter(CostMaterial.CodMat == item.matched_codmat).first()
            if mat:
                mat.CosMat = item.new_price
                
                # Check for synonym
                syn = db.query(MaterialSynonym).filter(
                    MaterialSynonym.provider_text == item.original_desc,
                    MaterialSynonym.CodMat == item.matched_codmat
                ).first()
                if not syn:
                    new_syn = MaterialSynonym(provider_text=item.original_desc, CodMat=item.matched_codmat)
                    db.add(new_syn)
                
                updated_count += 1
    
    db.commit()
    return {
        "status": "success",
        "updated_count": updated_count,
        "database_id": request.database_id or "master",
        "message": f"Se actualizaron {updated_count} precios en la base de datos seleccionada."
    }


@router.get('/bcv-rate')
def get_current_bcv_rate() -> Dict[str, Any]:
    """Retorna la tasa oficial del BCV en tiempo real para cotizaciones en moneda nacional."""
    try:
        rate = get_bcv_rate()
        return {"status": "success", "bcv_rate": rate}
    except Exception as e:
        logger.error(f"Error al obtener tasa BCV: {e}", exc_info=True)
        return {"status": "error", "bcv_rate": 848.55, "message": str(e)}


@router.get('/reference-items')
def get_reference_items(database_id: Optional[str] = "master", db: Session = Depends(get_db)) -> Dict[str, Any]:
    if database_id and database_id != "master":
        set_schema_for_db(db, database_id)

    codmats = [m["codmat"] for m in REFERENCE_MATERIALS_DEF]
    db_materials = db.query(CostMaterial).filter(CostMaterial.CodMat.in_(codmats)).all()
    mat_map = {m.CodMat: m for m in db_materials}

    items = []
    for def_item in REFERENCE_MATERIALS_DEF:
        cod = def_item["codmat"]
        mat = mat_map.get(cod)
        current_price = float(mat.CosMat) if mat and mat.CosMat is not None else 0.0
        is_leader = bool(mat and mat.market_indicator_id == mat.CodMat)
        items.append({
            "codmat": cod,
            "name": def_item["name"],
            "unit": def_item["unit"],
            "vendor": def_item["vendor"],
            "family_id": def_item["family_id"],
            "current_price": current_price,
            "is_leader": is_leader,
            "db_description": mat.Descri if mat else def_item["name"]
        })

    return {
        "status": "success",
        "database_id": database_id or "master",
        "total": len(items),
        "items": items
    }


@router.post('/analyze-vendor-quote')
async def analyze_vendor_quote(
    file: UploadFile = File(...),
    vendor_type: Optional[str] = "auto",
    database_id: Optional[str] = "master",
    exchange_rate: Optional[float] = 1.0,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    if database_id and database_id != "master":
        set_schema_for_db(db, database_id)

    file_bytes = await file.read()
    raw_text = ""

    # 1. Extracción de texto
    if file.filename.lower().endswith('.pdf'):
        try:
            # 1.1 Extracción rápida y precisa preservando la contigüidad de filas de la tabla con PyMuPDF
            doc = fitz.open(stream=file_bytes, filetype='pdf')
            for page in doc:
                raw_text += page.get_text() + "\n"

            # 1.2 Si es un PDF escaneado (sin capa de texto), OCR con Gemini Vision
            if len(raw_text.strip()) < 50:
                provider = db.query(LLMProvider).filter(LLMProvider.provider_key == 'gemini').first()
                if provider:
                    genai.configure(api_key=decrypt_api_key(provider.api_key_enc))

                raw_text = ""
                images = []
                for page in doc:
                    pix = page.get_pixmap(dpi=150)
                    img = PIL.Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    images.append(img)

                if images:
                    model = genai.GenerativeModel('gemini-1.5-flash')
                    prompt_content = images + ["Extrae todo el texto de estas imágenes exactamente como aparece. Solo devuelve el texto plano, sin formato adicional, concatenando todo."]
                    resp = model.generate_content(prompt_content)
                    raw_text = resp.text
        except Exception as e:
            logger.error(f"Error procesando PDF de cotización de proveedor: {e}", exc_info=True)
            raise HTTPException(status_code=400, detail=f"Error leyendo PDF: {str(e)}")
    elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        try:
            provider = db.query(LLMProvider).filter(LLMProvider.provider_key == 'gemini').first()
            if provider:
                genai.configure(api_key=decrypt_api_key(provider.api_key_enc))

            img = PIL.Image.open(io.BytesIO(file_bytes))
            model = genai.GenerativeModel('gemini-1.5-flash')
            resp = model.generate_content([img, "Extrae todo el texto de esta imagen exactamente como aparece. Solo devuelve el texto plano, sin formato adicional."])
            raw_text = resp.text
        except Exception as e:
            logger.error(f"Error procesando imagen de cotización de proveedor: {e}", exc_info=True)
            raise HTTPException(status_code=400, detail=f"Error en OCR de imagen: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Sube PDF, JPG o PNG.")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No se pudo extraer texto del documento.")

    # 2. Filtrar lista objetivo según proveedor
    if vendor_type == "matos":
        targets = [m for m in REFERENCE_MATERIALS_DEF if m["vendor"] == "Matos Suplidores"]
    elif vendor_type == "pall":
        targets = [m for m in REFERENCE_MATERIALS_DEF if m["vendor"] == "Pall Ferretería"]
    else:
        targets = REFERENCE_MATERIALS_DEF

    rate = float(exchange_rate) if exchange_rate and float(exchange_rate) > 0 else 1.0

    # 3. Fase 1: Extracción determinística ultra-rápida (Python + Regex sobre MarkItDown)
    direct_found = deterministic_extract_targets(raw_text, targets)
    found_codmats = {m["codmat"] for m in direct_found}

    # 4. Fase 2: LLM solo si faltan materiales y NO es Matos
    remaining_targets = [m for m in targets if m["codmat"] not in found_codmats]
    llm_found: List[Dict[str, Any]] = []

    # Para Matos NUNCA se llama al LLM: todo se cruza por códigos directos y catálogo
    if remaining_targets and vendor_type != "matos":
        prompt_extract = f"""
Eres un ingeniero de costos experto en análisis de precios unitarios (APU) y compras de ferretería y construcción.
A continuación tienes el texto y tablas extraídos de una cotización de materiales ({'Proveedor: ' + vendor_type.upper() if vendor_type else 'Proveedor de construcción'}).
Tu objetivo es buscar en el texto los precios cotizados para los siguientes materiales de referencia y NORMALIZARLOS A LA UNIDAD ESPERADA EN LA BASE APU.

LISTA DE MATERIALES OBJETIVO:
{json.dumps([{'codmat': m['codmat'], 'nombre': m['name'], 'unidad_esperada': m['unit'], 'proveedor_esperado': m['vendor'], 'codigos_proveedor_conocidos': m.get('vendor_codes', [])} for m in remaining_targets], ensure_ascii=False, indent=2)}

TEXTO DE LA COTIZACIÓN:
{raw_text}

REGLAS DE CONVERSIÓN DE PRESENTACIONES COMERCIALES A PRECIO UNITARIO APU:
1. Si el material se cotiza en ROLLO (ej: rollo cable 12 x 100m) y la unidad esperada es 'm', debes DIVIDIR el precio del rollo entre la longitud en metros (ej: $78.50 / 100m = $0.785/m).
2. Si el material se cotiza en BOLSA o CAJA (ej: 50 o 100 ramplug) y la unidad esperada es 'pza', debes DIVIDIR el precio del paquete entre la cantidad de piezas (ej: $4.50 / 50 = $0.09/pza).
3. Si la cabilla de 3/8" se cotiza por BARRA de 6 metros y la unidad esperada es 'kgf', una barra de 6m pesa 3.354 kg (0.559 kg/m * 6m); debes DIVIDIR el precio de la barra entre 3.354 kg para obtener el precio por kgf (ej: $6.58 / 3.354 = $1.962/kgf).
4. Si la lámina de yeso se cotiza por LÁMINA entera (1.22 x 2.44m = 2.977 m2) y la unidad esperada es 'm2', debes DIVIDIR el precio de la lámina entre 2.977 m2 para obtener el precio por m2.
5. Si ya viene cotizado en la unidad unitaria esperada (ej: saco de 42.5kg, metro cúbico de arena, galón de pintura), mantén el precio unitario tal cual.

INSTRUCCIONES DE RESPUESTA:
- Si el material no aparece en el texto, IGNÓRALO.
- Devuelve ÚNICAMENTE un objeto JSON estricto con esta estructura:
{{
  "matches": [
    {{
      "codmat": "CÓDIGO INTERNO APU EXACTO DE LA LISTA OBJETIVO (ej: ELE128)",
      "descripcion_cotizada": "Línea original + fórmula de conversión si aplicó",
      "precio_cotizado": 0.785,
      "unidad_cotizada": "m"
    }}
  ]
}}
"""
        try:
            extracted = call_llm_json(prompt_extract)
            if isinstance(extracted, dict):
                if "matches" in extracted and isinstance(extracted["matches"], list):
                    llm_found = extracted["matches"]
                elif "items" in extracted and isinstance(extracted["items"], list):
                    llm_found = extracted["items"]
                else:
                    for k, v in extracted.items():
                        if isinstance(v, list):
                            llm_found = v
                            break
            elif isinstance(extracted, list):
                llm_found = extracted
        except Exception as e:
            logger.warning(f"LLM no disponible o congestionado ({e}). Continuando con resultados determinísticos directos.")

    # Combinar resultados sin duplicados
    combined = direct_found + [item for item in llm_found if item.get("codmat") not in found_codmats]

    # 5. Detección automática de moneda (VES vs USD) y auto-aplicación de tasa BCV oficial
    is_ves = (
        vendor_type == "matos" 
        or "NETO BS" in raw_text.upper() 
        or "BOLIVARES" in raw_text.upper() 
        or any(it.get("precio_cotizado", 0) > 300 for it in combined)
    )

    effective_rate = rate
    auto_bcv_used = False

    # Si la cotización viene en bolívares y el usuario no colocó una tasa manual (> 1.0)
    if is_ves and rate <= 1.0:
        try:
            bcv = get_bcv_rate()
            if bcv and bcv > 1.0:
                effective_rate = float(bcv)
                auto_bcv_used = True
                logger.info(f"Tasa BCV oficial aplicada automáticamente a cotización en bolívares: {effective_rate}")
        except Exception as ex_bcv:
            logger.warning(f"Error al consultar tasa BCV oficial: {ex_bcv}")

    # Organizar resultados mapeados a los códigos
    matches: List[Dict[str, Any]] = []
    for item in combined:
        cod = item.get("codmat")
        if not cod:
            continue
        orig_price = float(item.get("precio_cotizado", 0.0))
        orig_desc = item.get("descripcion_cotizada", "")

        # Si está en VES, se convierte a USD dividiendo entre effective_rate
        if is_ves and effective_rate > 1.0:
            price_usd = round(orig_price / effective_rate, 4)
            if "BCV" not in orig_desc:
                orig_desc = f"{orig_desc} ({orig_price:,.2f} Bs / {effective_rate:.2f} BCV = ${price_usd:.2f})"
        else:
            price_usd = round(orig_price / rate, 4) if rate > 0 else orig_price

        matches.append({
            "codmat": cod,
            "original_desc": orig_desc,
            "original_price": orig_price,
            "new_price": price_usd,
            "unit": item.get("unidad_cotizada", ""),
            "vendor": vendor_type
        })

    return {
        "status": "success",
        "vendor_type": vendor_type,
        "database_id": database_id or "master",
        "total_matched": len(matches),
        "matches": matches,
        "currency_detected": "VES" if is_ves else "USD",
        "applied_exchange_rate": effective_rate,
        "auto_bcv_used": auto_bcv_used
    }


@router.post('/batch-update-reference')
def batch_update_reference(payload: BatchReferenceUpdateRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    if not payload.items:
        raise HTTPException(status_code=400, detail="No se recibieron ítems para actualizar.")

    if payload.database_id and payload.database_id != "master":
        set_schema_for_db(db, payload.database_id)

    updated_count = 0
    cascade_count = 0
    updated_codmats = []

    for item in payload.items:
        if not item.codmat or item.new_price <= 0:
            continue

        mat = db.query(CostMaterial).filter(CostMaterial.CodMat == item.codmat).first()
        if not mat:
            continue

        mat.CosMat = item.new_price
        updated_count += 1
        updated_codmats.append(item.codmat)

        # Si el material es líder de familia, aplicar dispersión a sus hijos
        if mat.market_indicator_id == mat.CodMat:
            children = db.query(CostMaterial).filter(
                CostMaterial.market_indicator_id == mat.CodMat,
                CostMaterial.CodMat != mat.CodMat
            ).all()
            for child in children:
                factor = child.market_factor if child.market_factor is not None else 1.0
                child.CosMat = item.new_price * factor
                cascade_count += 1

        # Registrar sinónimo si vino descripción del proveedor
        if item.original_desc:
            syn = db.query(MaterialSynonym).filter(
                MaterialSynonym.provider_text == item.original_desc,
                MaterialSynonym.CodMat == item.codmat
            ).first()
            if not syn:
                new_syn = MaterialSynonym(provider_text=item.original_desc, CodMat=item.codmat)
                db.add(new_syn)

    db.commit()

    return {
        "status": "success",
        "database_id": payload.database_id or "master",
        "updated_count": updated_count,
        "cascade_count": cascade_count,
        "message": f"Se actualizaron {updated_count} materiales de referencia y {cascade_count} insumos en cascada en la base seleccionada."
    }

