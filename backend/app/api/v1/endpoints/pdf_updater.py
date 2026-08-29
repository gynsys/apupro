from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.db.models.cost360 import CostMaterial, MaterialSynonym
from app.core.config import settings
from app.db.models.llm_provider import LLMProvider
from app.crud.llm import decrypt_api_key
import fitz  # PyMuPDF
import json
import io
import PIL.Image
from typing import List
from pydantic import BaseModel
import logging
import google.generativeai as genai

router = APIRouter()
logger = logging.getLogger(__name__)

class ApproveItem(BaseModel):
    original_desc: str
    matched_codmat: str
    new_price: float

class ApproveQuoteRequest(BaseModel):
    items: List[ApproveItem]


from app.services.llm_router import call_llm_json
from sqlalchemy import text


def lexical_search_materials(db: Session, query: str, limit: int = 5):
    words = [w for w in query.split() if len(w) > 2]
    if not words:
        return []
    tsquery_str = " | ".join(words)
    sql = text('''
        SELECT "CodMat", "Descri", "CosMat",
               ts_rank(to_tsvector('spanish', "Descri"), to_tsquery('spanish', :tsquery)) as rank
        FROM public.cost360_materials
        WHERE to_tsvector('spanish', "Descri") @@ to_tsquery('spanish', :tsquery)
        ORDER BY rank DESC
        LIMIT :limit
    ''')
    results = db.execute(sql, {"tsquery": tsquery_str, "limit": limit}).fetchall()
    return [{"id": r.CodMat, "desc": r.Descri, "current_price": r.CosMat} for r in results]

@router.post('/analyze-quote')
async def analyze_quote(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
[{{ "codigo_proveedor": "si aparece", "descripcion": "nombre del material", "precio": 15.5 }}]
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
    # Buscamos los top 5 candidatos para cada item
    items_para_prompt = []
    items_finales = []
    for idx, item in enumerate(items_extraidos):
        cod_prov = item.get('codigo_proveedor', '')
        desc = item.get('descripcion', '')
        precio = item.get('precio', 0.0)
        
        # El sinónimo será el código del proveedor + la descripción (para ser más únicos)
        syn_str = f"[{cod_prov}] {desc}" if cod_prov else desc

        # Verificar memoria (sinónimos guardados previamente)
        syn = db.query(MaterialSynonym).filter(MaterialSynonym.provider_text == syn_str).first()
        if syn:
            mat = db.query(CostMaterial).filter(CostMaterial.CodMat == syn.CodMat).first()
            items_finales.append({
                "original_desc": syn_str,
                "matched_codmat": syn.CodMat,
                "new_price": precio,
                "db_price": mat.CosMat if mat else None
            })
            continue

        candidatos = lexical_search_materials(db, desc, limit=5)
        items_para_prompt.append({
            "id_temporal": idx,
            "descripcion_cotizada": syn_str,
            "precio_cotizado": precio,
            "candidatos_db": candidatos
        })

    if items_para_prompt:
        prompt_paso2 = f'''
Eres un experto analista de costos. Tienes una lista de ítems extraídos de una cotización y, para cada uno, 5 posibles candidatos de nuestra base de datos.
Selecciona el 'id' (código) del candidato de la base de datos que sea EXACTAMENTE el mismo material cotizado. Si ninguno se parece, devuelve null para ese ítem.
Devuelve un JSON estrictamente con este formato (un diccionario que mapee el id_temporal al id del candidato seleccionado):
{{
    "0": "id_del_candidato_seleccionado_o_null",
    "1": "id_del_candidato_seleccionado_o_null"
}}

Datos a analizar:
{json.dumps(items_para_prompt, indent=2, ensure_ascii=False)}
'''
        try:
            resultado_final = call_llm_json(prompt_paso2)
        except Exception as e:
            logger.error(f"Error en Paso 2 (Matching IA): {e}")
            raise HTTPException(status_code=500, detail="Fallo al hacer el cruce de materiales con IA.")

        # Reconstruimos la lista final basándonos en el dict devuelto
        for item in items_para_prompt:
            matched_id = resultado_final.get(str(item["id_temporal"])) if isinstance(resultado_final, dict) else None
            db_price = None
            if matched_id:
                for c in item["candidatos_db"]:
                    if c["id"] == matched_id:
                        db_price = c["current_price"]
                        break
            
            items_finales.append({
                "original_desc": item["descripcion_cotizada"],
                "matched_codmat": matched_id,
                "new_price": item["precio_cotizado"],
                "db_price": db_price
            })

    return {"status": "success", "items": items_finales}

@router.post('/approve-quote')
async def approve_quote(request: ApproveQuoteRequest, db: Session = Depends(get_db)):
    updated_count = 0
    for item in request.items:
        if item.matched_codmat:
            mat = db.query(CostMaterial).filter(CostMaterial.CodMat == item.matched_codmat).first()
            if mat:
                mat.CosMat = item.new_price
                
                # Check for synonym
                syn = db.query(MaterialSynonym).filter(MaterialSynonym.provider_text == item.original_desc, MaterialSynonym.CodMat == item.matched_codmat).first()
                if not syn:
                    new_syn = MaterialSynonym(provider_text=item.original_desc, CodMat=item.matched_codmat)
                    db.add(new_syn)
                
                updated_count += 1
    
    db.commit()
    return {"status": "success", "updated_count": updated_count}
