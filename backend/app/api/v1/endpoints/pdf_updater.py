from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.db.models.cost360 import CostMaterial, MaterialSynonym
from app.core.config import settings
import fitz  # PyMuPDF
import json
from typing import List, Optional
from pydantic import BaseModel
import logging

try:
    from google import genai as genai_new
    from google.genai import types as genai_types
    GENAI_NEW = True
except ImportError:
    GENAI_NEW = False

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post('/analyze-quote')
async def analyze_quote(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not GENAI_NEW:
        raise HTTPException(status_code=500, detail="Se requiere la nueva SDK de Google GenAI para soportar Vision/Archivos.")
        
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="No hay GEMINI_API_KEY configurada.")

    client = genai_new.Client(api_key=api_key)
    
    file_bytes = await file.read()
    parts = []
    
    if file.filename.lower().endswith('.pdf'):
        try:
            doc = fitz.open(stream=file_bytes, filetype='pdf')
            for page in doc:
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes('png')
                parts.append(
                    genai_types.Part.from_bytes(
                        data=img_bytes,
                        mime_type='image/png'
                    )
                )
        except Exception as e:
            raise HTTPException(status_code=400, detail=d"Error leyendo PDF: {str(e)}")
    elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        mime = 'image/png' if file.filename.lower().endswith('.png') else 'image/jpeg'
        parts.append(
            genai_types.Part.from_bytes(
                data=file_bytes,
                mime_type=mime
            )
        )
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado. Sube PDF o Imagen.")

    materials = db.query(CostMaterial).all()
    synonyms = db.query(MaterialSynonym).all()
    
    cat_lines = [f\"{m.CodMat} | {m.Descri}\" for m in materials]
    cat_text = \"\\n\".join(cat_lines)
    
    syn_lines = [f\"Sinonimo '{s.synonym}' -> {s.codmat}\" for s in synonyms]
    syn_text = \"\\n\".join(syn_lines)
    
    prompt_text = f\"\"\"
    Eres un experto analista de costos y presupuestos de obra civil.
    He subido imágenes de una lista de precios o cotización de un profeedor.

    Tus tareas:
    1. Extrae todos los productos de las imágenes. Para cada producto, obtén:
       * original_desc: La descripción exacta como aparece en la imagen.
       * original_price: El precio unitario (solo el número, float).
       * unit: La unidad de medida (UND, M, M2, KG, etc).

    2. Empata/Cruza cada producto extraído con nuestro catálogo maestro.
       Catálogo maestro (Código | Descripción):
    {cat_text}

       Base de conocimiento de sinónimos previos:
    {syn_text}

    Para cada producto extraído, busca la mejor coincidencia semántica en el catálogo maestro.
    * Si estás seguro de la coincidencia, llena 'matched_codmat' con el Código exacto y 'matched_descri' con la Descripción exacta.
    * Si no encuentras coincidencia clara, deja 'matched_codmat' y 'matched_descrig como null.
    * En 'match_reason' explica brevemente por qué hiciste el match o por qué no encontraste.

    RESPONDE ÚNICAMENTE CON UN JSON ARRAY VÁLIDO. EL FORMATO DEBE SER:
    [
      {{
        \"original_desc\": \"string\",
        \"original_price\": float,
        \"unit\": \"string\",
        \"matched_codmat\": \"string o null\",
        \"matched_descri\": \"string o null\",
        \"match_reason\": \"string\"
      }}
    ]
    \"\"\"
    parts.append(prompt_text)

    config = genai_types.GenerateContentConfig(
        response_mime_type='application/json',
        temperature=0.1
    )
    
    try:
        response = client.models.generate_content(
            model='gemini-1.5-pro',
            contents=parts,
            config=config
        )
        
        raw_json = response.text.strip()
        if raw_json.startswith('```json'):
            raw_json = raw_json[7:-3].strip()
        elif raw_json.startswith('```'):
            raw_json = raw_json[3:-3].strip()
            
        parsed_data = json.loads(raw_json)
        return {\"status\": \"success\", \"items\": parsed_data}
        
    except Exception as e:
        logger.error(f\"Error en Gemini Vision: {str(e)}\")
        raise HTTPException(status_code=500, detail=f\"Error procesando documento con IA: {str(e)}\")

class ApproveItem(BaseModel):
    original_desc: str
    matched_codmat: str
    new_price: float

class ApproveQuoteRequest(BaseModel):
    items: List[ApproveItem]

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
        return {\"status\": \"success\", \"message\": f\"{len(request.items)} materiales actualizados exitosamente.\"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))