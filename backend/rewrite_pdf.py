import re

with open("app/api/v1/endpoints/pdf_updater.py", "r", encoding="utf-8") as f:
    content = f.read()

# Create the new code block
new_code = """
from app.services.llm_router import call_llm_json
from sqlalchemy import text
import pytesseract

def lexical_search_materials(db: Session, query: str, limit: int = 5):
    words = [w for w in query.split() if len(w) > 2]
    if not words:
        return []
    tsquery_str = " | ".join(words)
    sql = text('''
        SELECT "CodMat", "Descri",
               ts_rank(to_tsvector('spanish', "Descri"), to_tsquery('spanish', :tsquery)) as rank
        FROM public.cost360_materials
        WHERE to_tsvector('spanish', "Descri") @@ to_tsquery('spanish', :tsquery)
        ORDER BY rank DESC
        LIMIT :limit
    ''')
    results = db.execute(sql, {"tsquery": tsquery_str, "limit": limit}).fetchall()
    return [{"id": r.CodMat, "desc": r.Descri} for r in results]

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
            
            # Si el PDF era escaneado (sin texto) usamos Tesseract OCR
            if len(raw_text.strip()) < 50:
                raw_text = ""
                for page in doc:
                    pix = page.get_pixmap(dpi=150)
                    img = PIL.Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    raw_text += pytesseract.image_to_string(img, lang='spa') + "\\n"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error leyendo PDF: {str(e)}")
    elif file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        try:
            img = PIL.Image.open(io.BytesIO(file_bytes))
            raw_text = pytesseract.image_to_string(img, lang='spa')
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error leyendo Imagen OCR: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado.")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No se pudo extraer texto del documento.")

    # 2. Estructuración Inicial (IA Paso 1)
    prompt_paso1 = f'''
Eres un extractor de datos. Extrae todos los insumos y precios del siguiente texto (proveniente de OCR de una cotización).
Ignora basura o ruido del texto. Devuelve un arreglo JSON estricto con este formato:
[{{ "descripcion": "nombre del material", "precio": 15.5 }}]
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
    for idx, item in enumerate(items_extraidos):
        desc = item.get('descripcion', '')
        precio = item.get('precio', 0.0)
        candidatos = lexical_search_materials(db, desc, limit=5)
        items_para_prompt.append({
            "id_temporal": idx,
            "descripcion_cotizada": desc,
            "precio_cotizado": precio,
            "candidatos_db": candidatos
        })

    prompt_paso2 = f'''
Eres un experto analista de costos. Tienes una lista de ítems extraídos de una cotización y, para cada uno, 5 posibles candidatos de nuestra base de datos.
Selecciona el 'id' (código) del candidato de la base de datos que sea EXACTAMENTE el mismo material cotizado. Si ninguno se parece, devuelve null para ese ítem.
Devuelve un JSON estrictamente con este formato:
[{{
    "original_desc": "descripcion_cotizada",
    "matched_codmat": "id_del_candidato_seleccionado_o_null",
    "new_price": precio_cotizado
}}]

Datos a analizar:
{json.dumps(items_para_prompt, indent=2, ensure_ascii=False)}
'''
    try:
        resultado_final = call_llm_json(prompt_paso2)
    except Exception as e:
        logger.error(f"Error en Paso 2 (Matching IA): {e}")
        raise HTTPException(status_code=500, detail="Fallo al hacer el cruce de materiales con IA.")

    if isinstance(resultado_final, dict):
        for key in resultado_final.keys():
            if isinstance(resultado_final[key], list):
                resultado_final = resultado_final[key]
                break

    return {"status": "success", "items": resultado_final}

@router.post('/approve-quote')
async def approve_quote(request: ApproveQuoteRequest, db: Session = Depends(get_db)):
    updated_count = 0
    for item in request.items:
        if item.matched_codmat:
            mat = db.query(CostMaterial).filter(CostMaterial.CodMat == item.matched_codmat).first()
            if mat:
                mat.CosMat = item.new_price
                
                # Check for synonym
                syn = db.query(MaterialSynonym).filter(MaterialSynonym.synonym == item.original_desc, MaterialSynonym.codmat == item.matched_codmat).first()
                if not syn:
                    new_syn = MaterialSynonym(synonym=item.original_desc, codmat=item.matched_codmat)
                    db.add(new_syn)
                
                updated_count += 1
    
    db.commit()
    return {"status": "success", "updated_count": updated_count}
"""

# Find everything from @router.post('/analyze-quote') downwards and replace it
pattern = re.compile(r'@router\.post\(\'/analyze-quote\'\).*', re.DOTALL)
new_content = pattern.sub(new_code, content)

with open("app/api/v1/endpoints/pdf_updater.py", "w", encoding="utf-8") as f:
    f.write(new_content)
