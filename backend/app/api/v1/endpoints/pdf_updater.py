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

@router.post('/analyze-quote')
async def analyze_quote(file: UploadFile = File(...), db: Session = Depends(get_db)):
    provider = db.query(LLMProvider).filter(LLMProvider.provider_key == "gemini", LLMProvider.is_active == True).first()
    if not provider:
        raise HTTPException(status_code=500, detail="No hay proveedor Gemini activo en la Base de Datos.")
    
    api_key = decrypt_api_key(provider.api_key_enc)
    model_name = provider.model_name
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

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
    except Exception as e:
        logger.warning(f"Gemini falló ({str(e)}). Intentando respaldo con Groq Vision...")
        
        provider_groq = db.query(LLMProvider).filter(LLMProvider.provider_key == "groq").first()
        if not provider_groq:
            raise HTTPException(status_code=500, detail=f"Gemini falló y no hay Groq configurado. Error Gemini: {str(e)}")
            
        api_key_groq = decrypt_api_key(provider_groq.api_key_enc)
        import base64
        import requests
        
        content_arr = [{"type": "text", "text": prompt_text}]
        for item in parts:
            if isinstance(item, PIL.Image.Image):
                buffered = io.BytesIO()
                item.save(buffered, format="JPEG")
                img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
                content_arr.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}
                })
                
        payload = {
            "model": "llama-3.2-90b-vision-preview",
            "messages": [{"role": "user", "content": content_arr}],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }
        
        headers = {
            "Authorization": f"Bearer {api_key_groq}",
            "Content-Type": "application/json"
        }
        
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Gemini excedió límite y Groq falló: {resp.text}")
            
        raw_json = resp.json()["choices"][0]["message"]["content"].strip()

    try:
        if raw_json.startswith('```json'):
            raw_json = raw_json[7:-3].strip()
        elif raw_json.startswith('```'):
            raw_json = raw_json[3:-3].strip()
            
        parsed_data = json.loads(raw_json)
        if isinstance(parsed_data, dict):
            for key in parsed_data.keys():
                if isinstance(parsed_data[key], list):
                    parsed_data = parsed_data[key]
                    break
                    
        return {"status": "success", "items": parsed_data}
        
    except Exception as e:
        logger.error(f"Error parseando JSON de IA: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error parseando JSON de IA: {str(e)}")

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