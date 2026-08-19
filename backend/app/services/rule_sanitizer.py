"""
Rule-based material description sanitizer.
No LLM needed - fast, free, and deterministic.
"""
import re
from typing import List, Dict


# --- Normalization maps ---
UNIT_MAP = {
    r'\bM3\b': 'm³', r'\bm3\b': 'm³', r'\bM2\b': 'm²', r'\bm2\b': 'm²',
    r'\bM1\b': 'ml', r'\bML\b': 'ml', r'\bKGS\b': 'kg', r'\bKgs\b': 'kg',
    r'\bKG\b': 'kg', r'\bKGS\.\b': 'kg', r'\bLTS\b': 'lt', r'\bLts\b': 'lt',
    r'\bLT\b': 'lt', r'\bGLS\b': 'gal', r'\bGls\b': 'gal', r'\bGAL\b': 'gal',
    r'\bUND\b': 'und', r'\bUnd\b': 'und', r'\bUN\b': 'und',
    r'\bMTS\b': 'm', r'\bMts\b': 'm', r'\bML\b': 'ml',
    r'\bMM\b': 'mm', r'\bCM\b': 'cm', r'\bPLG\b': 'plg',
    r'\bPZA\b': 'pza', r'\bPZAS\b': 'pzas', r'\bPCS\b': 'pzas',
}

# Common abbreviation expansions
ABBREV_MAP = {
    r'\bCONC\.\b': 'Concreto', r'\bCONC\b': 'Concreto',
    r'\bCEM\.\b': 'Cemento', r'\bCEM\b': 'Cemento',
    r'\bGALV\.\b': 'Galvanizado', r'\bGALV\b': 'Galvanizado',
    r'\bREF\.\b': 'Reforzado', r'\bREF\b': 'Reforzado',
    r'\bACERO REF\b': 'Acero de Refuerzo',
    r'\bAC\.\b': 'Acero', r'\bVAR\.\b': 'Varilla',
    r'\bDIAM\.\b': 'Diámetro', r'\bDIAM\b': 'Diámetro',
    r'\bGRAD\b': 'Grado', r'\bRESIS\b': 'Resistencia',
    r'\bPROF\b': 'Profundidad', r'\bALT\b': 'Altura',
    r'\bANCH\b': 'Ancho', r'\bLONG\b': 'Longitud',
    r'\bESP\b': 'Espesor', r'\bDIAM\b': 'Diámetro',
    r'\bTUB\b': 'Tubería', r'\bTUBO\b': 'Tubo',
    r'\bELEC\b': 'Eléctrico', r'\bHIDR\b': 'Hidráulico',
    r'\bNEUMAT\b': 'Neumático', r'\bSANIT\b': 'Sanitario',
    r'\bESTRUC\b': 'Estructural', r'\bCOMERC\b': 'Comercial',
    r'\bINDUST\b': 'Industrial', r'\bNAC\b': 'Nacional',
    r'\bIMP\b': 'Importado', r'\bALUM\b': 'Aluminio',
    r'\bPVC\b': 'PVC', r'\bHDP\b': 'HDPE', r'\bPPRC\b': 'PP-RC',
    r'\bGPL\b': 'GPL', r'\bGAS\b': 'Gas',
}

# Words that should always be uppercase
ALWAYS_UPPER = {'PVC', 'HDPE', 'PPR', 'PP', 'ABS', 'ASTM', 'AISI', 'ISO',
                'AWG', 'EMT', 'IMC', 'RSC', 'NM', 'MC', 'AC', 'DC', 'LED',
                'THHN', 'THWN', 'GPL', 'GLP', 'GNC', 'SBS', 'APP'}

# Words that should always be lowercase (articles/prepositions)
ALWAYS_LOWER = {'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u',
                'a', 'en', 'con', 'por', 'para', 'sin', 'entre', 'sobre'}


def _normalize_whitespace(text: str) -> str:
    """Remove extra spaces, tabs, newlines."""
    return re.sub(r'\s+', ' ', text).strip()


def _apply_map(text: str, replacements: Dict[str, str]) -> str:
    """Apply a dictionary of regex replacements."""
    for pattern, replacement in replacements.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def _smart_title_case(text: str) -> str:
    """Title case with exceptions for acronyms and prepositions."""
    words = text.split()
    result = []
    for i, word in enumerate(words):
        upper_word = word.upper().strip('.,;:()-')
        if upper_word in ALWAYS_UPPER:
            result.append(upper_word)
        elif word.lower().strip('.,;:()-') in ALWAYS_LOWER and i > 0:
            result.append(word.lower())
        else:
            result.append(word.capitalize())
    return ' '.join(result)


def _remove_weird_chars(text: str) -> str:
    """Remove non-printable and problematic characters."""
    # Keep: letters, digits, spaces, common punctuation, accented chars
    text = re.sub(r'[^\w\s\-\.\,\(\)\%\/\°\#\+\'\"\³\²]', ' ', text)
    return text


def _detect_family(description: str) -> str:
    """Detect material family based on description keywords."""
    desc = description.upper()
    
    families = {
        'CEMENTO/CAL': ['CEMENTO', 'CAL ', 'MORTERO', 'YESO', 'FRAGUADO'],
        'ACERO/HIERRO': ['ACERO', 'HIERRO', 'VARILLA', 'CABILLA', 'PERFIL', 'VIGA', 'COLUMNA', 'ÁNGULO'],
        'COBRE/ALUMINIO': ['COBRE', 'ALUMINIO', 'CABLE', 'CONDUCTOR', 'AWG', 'THHN', 'THWN'],
        'PINTURA/RECUBRIMIENTOS': ['PINTURA', 'ESMALTE', 'CAUCHO', 'LÁTEX', 'BARNIZ', 'IMPERMEABILIZ'],
        'ÁRIDOS/PÉTREOS': ['ARENA', 'PIEDRA', 'GRAVEL', 'GRABA', 'MATERIAL SELECTO', 'RELLENO'],
        'PVC/TUBERÍAS': ['PVC', 'TUBERÍA', 'TUBO', 'CODO', 'TEE', 'FITTING', 'REDUCCIÓN', 'HIDRÁULICO'],
        'MADERA': ['MADERA', 'TABLA', 'TABLÓN', 'VIGUETA', 'MACHIMBRADO', 'CONTRACHAPADO'],
        'CERÁMICAS/PISOS': ['CERÁMICA', 'PORCELANATO', 'MOSAICO', 'AZULEJO', 'PISO', 'PARED'],
        'BLOQUES/LADRILLOS': ['BLOQUE', 'LADRILLO', 'TABIQUE', 'ARCILLA', 'REFRACTARIO'],
        'EQUIPOS MECÁNICOS': ['BOMBA', 'MOTOR', 'VENTILADOR', 'COMPRESOR', 'GENERADOR'],
        'ELECTRICIDAD': ['BREAKER', 'TABLERO', 'TOMACORRIENTE', 'INTERRUPTOR', 'LED', 'LUMINARIA'],
    }
    
    for family, keywords in families.items():
        if any(kw in desc for kw in keywords):
            return family
    
    return 'GENERAL'


def sanitize_single(description: str) -> Dict[str, str]:
    """
    Clean a single material description using rules only.
    Returns dict with clean_description and family.
    """
    if not description:
        return {'clean_description': '', 'family': 'GENERAL'}
    
    text = description
    
    # Step 1: Basic cleanup
    text = _normalize_whitespace(text)
    text = _remove_weird_chars(text)
    text = _normalize_whitespace(text)
    
    # Step 2: Apply abbreviation expansions (before case normalization)
    text = _apply_map(text, ABBREV_MAP)
    
    # Step 3: Apply unit normalization
    text = _apply_map(text, UNIT_MAP)
    
    # Step 4: Smart title case
    text = _smart_title_case(text)
    
    # Step 5: Final whitespace cleanup
    text = _normalize_whitespace(text)
    
    # Detect family from original description (more reliable with raw text)
    family = _detect_family(description)
    
    return {
        'clean_description': text,
        'family': family
    }


def sanitize_batch_rules(materials: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Process a batch of materials using rule-based sanitization.
    Input: [{"id": "...", "description": "..."}, ...]
    Output: [{"id": "...", "original": "...", "clean": "...", "family": "..."}, ...]
    """
    results = []
    for mat in materials:
        mat_id = mat.get('id', '')
        original = mat.get('description', '')
        sanitized = sanitize_single(original)
        results.append({
            'id': mat_id,
            'original': original,
            'clean': sanitized['clean_description'],
            'family': sanitized['family'],
            'method': 'rules'
        })
    return results
