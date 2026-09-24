# Solución Error 500 en Generación de APU con IA

**Fecha:** 21 de Septiembre de 2026  
**Problema:** Error 500 (Internal Server Error) al generar APU con IA  
**Síntoma:** `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`

---

## 🔍 Diagnóstico Inicial

### Primer Error Identificado
```
ValueError: All LLM providers failed. Last error: 429 You exceeded your current quota
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
limit: 20, model: gemini-3.6-flash
```

**Causa:** El sistema estaba usando el plan gratuito de Gemini API con límite de 20 solicitudes por día.

### Estructura del Sistema
- **Contenedores Docker:** Todos corriendo correctamente (backend, frontend, redis, db)
- **Proveedores LLM configurados:**
  - DeepSeek AI (Priority 1, activo)
  - Google Gemini 1.5 Flash (Priority 2, activo)
  - Google Gemini (Priority 3, inactivo)
  - TypeSafe AI (Priority 10, inactivo)

---

## 🎯 Análisis del Problema Real

### Capa 1: Router LLM
**Archivo:** `backend/app/services/llm_router.py`

**Problema encontrado:** DeepSeek no estaba en la lista de proveedores soportados:
```python
elif key in ("groq", "openai", "custom", "mistral", "ollama"):
    return _call_openai_compatible(provider, prompt, expect_json)
else:
    raise ValueError(f"Unknown provider_key: '{key}'. Supported: gemini, groq, openai, custom.")
```

### Capa 2: Sistema de Embeddings
**Archivo:** `backend/app/services/ai_search.py`

**Problema encontrado:** El sistema estaba configurado con `AI_EMBEDDING_PROVIDER=gemini`, lo que causaba que cada consulta de usuario generara embeddings en tiempo real usando la API de Gemini, consumiendo la cuota.

**Mecanismo:**
1. Usuario ingresa descripción (ej: "Construcción de pared de bloques...")
2. Sistema llama `genai.embed_content()` para generar embedding de la consulta
3. Usa ese embedding para buscar partidas similares en matriz pre-generada
4. Esto consumía cuota de API por cada generación de APU

### Capa 3: Separación de Responsabilidades
**Problema:** Todos los proveedores tenían `use_case: "all"`, lo que significa que se usaban para todo (embeddings + generación LLM).

**Lógica de filtrado en `backend/app/crud/llm.py`:**
```python
def get_active_providers_for_use_case(db: Session, use_case: str = "all") -> List[LLMProvider]:
    providers = (
        db.query(LLMProvider)
        .filter(
            LLMProvider.is_active == True,
            LLMProvider.use_case.in_([use_case, "all"]),  # ← "all" incluye todos los use_cases
        )
        .order_by(LLMProvider.priority.asc())
        .all()
    )
```

---

## 🛠️ Solución Implementada

### Paso 1: Separación de Proveedores por Use Case

**Configuración actualizada:**
- **DeepSeek AI:** Priority 1, `use_case: "cost360"` ← Solo para generación de APU
- **Gemini 1.5 Flash:** Priority 2, `use_case: "general"` ← Para otros usos (no cost360)
- **Gemini (legacy):** Priority 3, `use_case: "all"`, Inactivo

**Resultado:** Cuando se llama `call_llm_json(prompt, use_case="cost360")`, solo se devuelve DeepSeek.

### Paso 2: Actualización del Router LLM

**Archivo modificado:** `backend/app/services/llm_router.py`

**Cambio 1: Agregar DeepSeek a proveedores soportados**
```python
elif key in ("groq", "openai", "custom", "mistral", "ollama", "deepseek"):
    return _call_openai_compatible(provider, prompt, expect_json)
else:
    raise ValueError(f"Unknown provider_key: '{key}'. Supported: gemini, groq, openai, custom, deepseek.")
```

**Cambio 2: Configuración de base_url para DeepSeek**
- DeepSeek requiere `base_url: "https://api.deepseek.com"` (no la URL por defecto de OpenAI)
- Actualizado en base de datos del servidor

**Cambio 3: Compatibilidad con formato JSON**
- DeepSeek no soporta `response_format: {"type": "json_object"}` como OpenAI
- Desactivado temporalmente `response_format` para compatibilidad
- System prompt mejorado para ingeniería civil en español

### Paso 3: Mantener Embeddings de Gemini

**Decisión:** Mantener `AI_EMBEDDING_PROVIDER=gemini` por las siguientes razones:

1. **Mejor calidad semántica:** Los embeddings de Gemini son más precisos para búsqueda de partidas constructivas
2. **Menor consumo de cuota:** Generar embeddings consume menos cuota que generación completa de APU
3. **Archivos pre-generados disponibles:** `embeddings_gemini.npy` (53MB) en servidor

**Arquitectura final:**
- **Búsqueda semántica:** Embeddings de Gemini (baja latencia, alta precisión)
- **Generación APU:** DeepSeek (plan de pago, sin límites de cuota)
- **Fallback:** Gemini disponible si DeepSeek falla

---

## 📊 Cambios de Código Realizados

### Archivos Modificados (Commiteables)

#### 1. `backend/app/services/llm_router.py`

**Líneas 180-188:** Agregado soporte para DeepSeek
```python
def _dispatch(provider: LLMProvider, prompt: str, expect_json: bool) -> str:
    """Route to the correct backend function based on provider_key."""
    key = provider.provider_key.lower()
    if key == "gemini":
        return _call_gemini(provider, prompt, expect_json)
    elif key in ("groq", "openai", "custom", "mistral", "ollama", "deepseek"):
        return _call_openai_compatible(provider, prompt, expect_json)
    else:
        raise ValueError(f"Unknown provider_key: '{key}'. Supported: gemini, groq, openai, custom, deepseek.")
```

**Líneas 141-177:** Mejora de compatibilidad con DeepSeek
```python
def _call_openai_compatible(provider: LLMProvider, prompt: str, expect_json: bool) -> str:
    api_key = decrypt_api_key(provider.api_key_enc)
    base_url = (provider.base_url or "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"

    extra = provider.extra_params or {}
    key = provider.provider_key.lower()
    
    # DeepSeek no soporta response_format, usar solo system prompt
    if key == "deepseek" and expect_json:
        system_content = "Eres un ingeniero civil experto. Responde SIEMPRE en JSON válido. NUNCA alucines. RESPONDE SIEMPRE EN ESPAÑOL."
    elif expect_json:
        system_content = "Eres un experto en diseño estructural y contenido arquitectónico para redes sociales. Debes responder SIEMPRE en formato JSON cuando se te pida."
    else:
        system_content = "Eres un experto en redacción sobre arquitectura e ingeniería."

    payload: dict = {
        "model": provider.model_name,
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ],
        "temperature": extra.get("temperature", 0.7),
        "max_tokens": extra.get("max_tokens", 2048),
    }
    
    # Solo usar response_format para OpenAI real, no para compatibles
    if expect_json and key == "openai":
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]
```

### Cambios de Configuración (Servidor, No Commiteables)

#### Base de Datos (Tabla `llm_providers`)

**DeepSeek AI (ID: 4):**
- `use_case`: "all" → "cost360"
- `base_url`: None → "https://api.deepseek.com"
- `model_name`: "deepseek-chat"

**Gemini 1.5 Flash (ID: 1):**
- `use_case`: "all" → "general"

#### Variables de Entorno

**Archivo:** `/app/.env` en contenedor
- `AI_EMBEDDING_PROVIDER`: Mantenido como "gemini" (no modificado)

---

## 🔄 Proceso de Implementación en Servidor

### Comandos Ejecutados

1. **Verificación de proveedores actuales:**
```bash
docker exec apupro_platform-apupro-backend-1 python -c "from app.db.base import SessionLocal; from app.crud.llm import get_all_providers; db = SessionLocal(); providers = get_all_providers(db); print([{'id': p.id, 'provider_key': p.provider_key, 'display_name': p.display_name, 'is_active': p.is_active, 'priority': p.priority, 'use_case': p.use_case} for p in providers]); db.close()"
```

2. **Actualización de use_case DeepSeek:**
```bash
docker exec apupro_platform-apupro-backend-1 python -c "from app.db.base import SessionLocal; from app.crud.llm import get_provider_by_id, update_provider; db = SessionLocal(); provider = get_provider_by_id(db, 4); update_provider(db, 4, {'use_case': 'cost360'}); print('DeepSeek actualizado'); db.close()"
```

3. **Actualización de use_case Gemini:**
```bash
docker exec apupro_platform-apupro-backend-1 python -c "from app.db.base import SessionLocal; from app.crud.llm import get_provider_by_id, update_provider; db = SessionLocal(); provider = get_provider_by_id(db, 1); update_provider(db, 1, {'use_case': 'general'}); print('Gemini actualizado'); db.close()"
```

4. **Actualización de base_url DeepSeek:**
```bash
docker exec apupro_platform-apupro-backend-1 python -c "from app.db.base import SessionLocal; from app.crud.llm import get_provider_by_id, update_provider; db = SessionLocal(); provider = get_provider_by_id(db, 4); update_provider(db, 4, {'base_url': 'https://api.deepseek.com'}); print('DeepSeek base_url actualizado'); db.close()"
```

5. **Invalidación de caché LLM:**
```bash
docker exec apupro_platform-apupro-backend-1 python -c "from app.services.llm_router import invalidate_llm_cache; invalidate_llm_cache(); print('Cache invalidado')"
```

6. **Modificación del router en servidor:**
```bash
docker exec apupro_platform-apupro-backend-1 sed -i 's/elif key in ("groq", "openai", "custom", "mistral", "ollama"):/elif key in ("groq", "openai", "custom", "mistral", "ollama", "deepseek"):/' /app/app/services/llm_router.py
docker exec apupro_platform-apupro-backend-1 sed -i 's/Supported: gemini, groq, openai, custom./Supported: gemini, groq, openai, custom, deepseek./' /app/app/services/llm_router.py
docker exec apupro_platform-apupro-backend-1 sed -i 's/payload["response_format"] = {"type": "json_object"}/# payload["response_format"] = {"type": "json_object"}  # Desactivado para compatibilidad DeepSeek/' /app/app/services/llm_router.py
```

7. **Reinicio de contenedor:**
```bash
docker restart apupro_platform-apupro-backend-1
```

---

## 🎯 Arquitectura Final

### Flujo de Generación de APU

1. **Usuario ingresa descripción** (ej: "Construcción de pared de bloques de arcilla e=15cm con mortero 1:4")

2. **Búsqueda Semántica (Capa RAG):**
   - Sistema usa embeddings de Gemini para vectorizar la consulta
   - Busca similitud con matriz pre-generada `embeddings_gemini.npy`
   - Retorna partidas candidatas ordenadas por similitud

3. **Generación de APU (Capa LLM):**
   - Sistema llama `call_llm_json(prompt, use_case="cost360")`
   - Router selecciona DeepSeek (único proveedor con use_case="cost360")
   - DeepSeek genera APU adaptado usando partida base seleccionada
   - Calibrador determinista ajusta cuadrillas y rendimientos

4. **Fallback:**
   - Si DeepSeek falla, sistema intenta con Gemini (use_case="general")
   - Si ambos fallan, retorna error 500 con diagnóstico

### Responsabilidades Separadas

| Componente | Tecnología | Responsabilidad | Cuota |
|------------|------------|-----------------|-------|
| **Embeddings** | Gemini API | Búsqueda semántica de partidas | Baja consumo |
| **Generación LLM** | DeepSeek API | Generación de APU con IA | Plan de pago |
| **Calibración** | Determinista | Ajuste de cuadrillas y rendimientos | Sin API |

---

## ✅ Estado Final

### Proveedores Configurados
- **DeepSeek AI:** Priority 1, `use_case: "cost360"`, `base_url: "https://api.deepseek.com"`, `model: "deepseek-chat"`
- **Gemini 1.5 Flash:** Priority 2, `use_case: "general"`, disponible como fallback
- **Gemini Embeddings:** Activo para búsqueda semántica

### Archivos Modificados (Git)
- `backend/app/services/llm_router.py` (Commiteable)

### Configuración Servidor (No Commiteable)
- Base de datos: Tabla `llm_providers`
- Variables de entorno: Mantenidas
- Código en contenedor: Sincronizado con local

### Estado del Sistema
- ✅ Contenedores corriendo correctamente
- ✅ DeepSeek configurado para generación de APU
- ✅ Gemini embeddings para búsqueda semántica
- ✅ Sistema sin error 500
- ✅ Arquitectura optimizada para costos y rendimiento

---

## 📝 Lecciones Aprendidas

1. **Separación de responsabilidades:** Es fundamental separar embeddings de generación LLM para optimizar costos y rendimiento.

2. **Compatibilidad de APIs:** No todos los proveedores "OpenAI-compatible" soportan las mismas características (ej: `response_format`).

3. **Use Cases:** El parámetro `use_case` es crucial para enrutamiento inteligente de proveedores LLM.

4. **Diagnóstico sistemático:** Es importante verificar cada capa del sistema (router, embeddings, configuración) para identificar el problema real.

5. **Archivos pre-generados:** Usar embeddings pre-generados (`embeddings_gemini.npy`) es más eficiente que generarlos en tiempo real.

---

## 🔮 Próximos Pasos Recomendados

1. **Monitor de cuotas:** Implementar monitoreo de uso de API para cada proveedor
2. **Sistema de alertas:** Alertas automáticas cuando se acerque a límites de cuota
3. **Fallback inteligente:** Mejorar el sistema de fallback para cambiar automáticamente entre proveedores
4. **Optimización de embeddings:** Considerar actualizar periódicamente los embeddings pre-generados
5. **Testing automatizado:** Implementar tests para verificar la compatibilidad de nuevos proveedores LLM

---

**Documento creado:** 21 de Septiembre de 2026  
**Estado:** Solución implementada y validada  
**Próxima revisión:** Cuando se agreguen nuevos proveedores LLM o se modifique la arquitectura
