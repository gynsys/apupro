from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.db.models.cost360 import CostMaterial, MaterialSynonym
from app.core.config import settings
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

@router.post('/analyze-quote')
async def analyze_quote(file: UploadFile = File(...), db: Session = Depends(get_db)):
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="No hay GEMINI_API_KEY configurada.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')

    file_bytes = await file.read()
    parts = []
    
    if file.filename.lower().endswith('.pdf'):
        try:
            doc = fitz.open(stream=file_bytes, filetype='pdf')
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes('png')
                img = PIL.Image.open(io.BytesIO(img_bytes))
                parts.append(img)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error leyendo PDF: {str(e)}")
    elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        img = PIL.Image.open(io.BytesIO(file_bytes))
        parts.append(img)
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado. Sube PDF o Imagen.")

    materials = db.query(CostMaterial).all()
    synonyms = db.query(MaterialSynonym).all()
    
    cat_lines = [f"{m.CodMat} | {m.Descri}" for m in materials]
    cat_text = "\n".join(cat_lines)
    
    syn_lines = [f"Sinonimo '{s.synonym}' -> {s.codmat}" for s in synonyms]
    syn_text = "\n".join(syn_lines)
    
    prompt_text = f"""
Eres un experto analista de costos y presupuestos de obra civil.
He subido imágenes de una lista de precios o cotización de un proveedor.

Tus tareas:
1. Extrae todos los productos de las imágenes. Para cada producto, obtén:
   - original_desc: La descripción exacta como aparece en la imagen.
   - original_price: El precio unitario (solo el número, float).
   - unit: La unidad de medida (UND, M, M2, KG, etc).

2. Empata/Cruza cada producto extraído con nuestro catálogo maestro.
   Catálogo maestro (Código | Descripción):
{cat_text}

   Base de conocimiento de sinónimos previos:
{syn_text}

Para cada producto extraído, busca la mejor coincidencia semántica en el catálogo maestro.
- Si estás seguro de la coincidencia, llena 'matched_codmat' con el Código exacto y 'matched_descri' con la Descripción exacta del catálogo.
- Si no encuentras coincidencia clara, deja 'matched_codmat' y 'matched_descri' como null.
- En 'match_reason' explica brevemente en español por qué hiciste el match o por qué no encontraste (máx 10 palabras).

RESPONDE ÚNICAMENTE CON UN JSON ARRAY VÁLIDO. NO USES MARKDOWN (SIN ```json). EL FORMATO DEBE SER:
[
  {{
    "original_desc": "string",
    "original_price": float,
    "unit": "string",
    "matched_codmat": "string o null",
    "matched_descri": "string o null",
    "match_reason": "string"
  }}
]
"""
    parts.append(prompt_text)
    
    try:
        response = model.generate_content(
            parts,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )
        
        raw_json = response.text.strip()
        if raw_json.startswith('```json'):
            raw_json = raw_json[7:-3].strip()
        elif raw_json.startswith('```'):
            raw_json = raw_json[3:-3].strip()
            
        parsed_data = json.loads(raw_json)
        return {"status": "success", "items": parsed_data}
        
    except Exception as e:
        logger.error(f"Error en Gemini Vision: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error procesando documento con IA: {str(e)}")

@router.post('/approve-quote')
async def approve_quote(request: ApproveQuoteRequest, db: Session = Depends(get_db)):
    try:
        for item in request.items:
            mat = db.query(CostMaterial).filter(CostMaterial.CodMat == item.matched_codmat).first()
            if mat:
                mat.CosMat = item.new_price
                
            syn = db.query(MaterialSynonym).filter(MaterialSynonym.synonym == item.original_desc).first()
            if not syn:
                new_syn = MaterialSynonym(
                    synonym=item.original_desc,
                    codmat=item.matched_codmat,
                    confidence=1.0,
                    source='pdf_upload'
                )
                db.add(new_syn)
        
        db.commit()
        return {"status": "success", "message": f"{len(request.items)} materiales actualizados exitosamente."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))