/**
 * Auditor Semántico y Enriquecedor de Descripciones Técnicas para APUs.
 *
 * Evalúa si una partida posee la información constructiva necesaria
 * (Acción, Elemento, Especificaciones Técnicas y Alcance) antes de
 * pasar al generador de APUs con IA, evitando alucinaciones de materiales
 * y rendimientos.
 */

export const ACTION_PATTERNS = [
  { root: 'demol', label: 'Demolición' },
  { root: 'tumbar', label: 'Demolición' },
  { root: 'derrib', label: 'Demolición' },
  { root: 'picar', label: 'Picado / Remoción' },
  { root: 'desmantel', label: 'Desmantelamiento' },
  { root: 'suministr', label: 'Suministro e instalación' },
  { root: 'instal', label: 'Instalación' },
  { root: 'colocac', label: 'Colocación' },
  { root: 'coloc', label: 'Colocación' },
  { root: 'montaj', label: 'Montaje' },
  { root: 'constru', label: 'Construcción' },
  { root: 'levant', label: 'Construcción' },
  { root: 'fabric', label: 'Fabricación' },
  { root: 'excav', label: 'Excavación' },
  { root: 'vaci', label: 'Vaciado de concreto' },
  { root: 'armad', label: 'Armado de refuerzo' },
  { root: 'encofr', label: 'Encofrado' },
  { root: 'repar', label: 'Reparación' },
  { root: 'rehabilit', label: 'Rehabilitación' },
  { root: 'restaur', label: 'Restauración' },
  { root: 'fris', label: 'Construcción de friso' },
  { root: 'revoqu', label: 'Revoque' },
  { root: 'encamis', label: 'Encamisado de paredes' },
  { root: 'empast', label: 'Empastado' },
  { root: 'pint', label: 'Aplicación de pintura' },
  { root: 'acarr', label: 'Acarreo de materiales' },
  { root: 'bote', label: 'Bote de escombros' },
  { root: 'botar', label: 'Bote de escombros' },
  { root: 'transpor', label: 'Transporte' },
  { root: 'limpiez', label: 'Limpieza' },
  { root: 'impermeabiliz', label: 'Impermeabilización' },
  { root: 'replant', label: 'Replanteo' },
  { root: 'nivel', label: 'Nivelación' },
  { root: 'compact', label: 'Compactación' }
];

export const ELEMENT_PATTERNS = [
  'pared', 'muro', 'tabique', 'bloque', 'ladrillo', 'concreto', 'viga', 'columna',
  'zapata', 'fundacion', 'cimiento', 'piso', 'ceramica', 'porcelanato', 'granito',
  'tuberia', 'tubo', 'pvc', 'acero', 'hierro', 'metalic', 'baranda', 'escalera',
  'bomba', 'tanque', 'valvula', 'puerta', 'ventana', 'reja', 'porton',
  'techo', 'cielorraso', 'cubierta', 'mortero', 'friso', 'escombro', 'tierra', 'zanja',
  'cabilla', 'malla', 'tablero', 'cable', 'conductor', 'luminaria', 'lampara',
  'tomacorriente', 'interruptor', 'drywall', 'yeso', 'manto', 'asfalto'
];

export const SPEC_REGEX = /(?:e\s*=|espesor|d\s*=|diametro|f'?c|kg\/cm2|psi|calibre|cal\b|\b\d+(?:[.,]\d+)?\s*(?:cm|mm|m\b|"|''|pulg|hp|kva|w\b|btu|kg|ton)|1:\d|caucho|esmalte|epoxic|antioxid|antialcalino|premezclad|arcilla|cemento)/i;

/**
 * Plantillas inteligentes para enriquecer partidas ambiguas típicas.
 */
const CANONICAL_TEMPLATES = [
  {
    match: /friso|revoque|tarrajeo/i,
    enrich: (orig) => {
      const isExt = /exterior|fachada/i.test(orig);
      return `CONSTRUCCIÓN DE FRISO ACABADO LISO EN ${isExt ? 'PAREDES EXTERIORES' : 'PAREDES INTERIORES'}, INCLUYE MORTERO 1:4, REMATE DE ARISTAS Y ANDAMIOS HASTA H=3.00M`;
    }
  },
  {
    match: /pintura|pintar|esmalte/i,
    enrich: (orig) => {
      const isExt = /exterior|fachada/i.test(orig);
      return isExt
        ? 'APLICACIÓN DE PINTURA DE CAUCHO ELASTOMÉRICA PARA EXTERIORES EN FACHADAS, INCLUYE FONDO ANTIALCALINO Y 2 MANOS DE ACABADO'
        : 'APLICACIÓN DE PINTURA DE CAUCHO MATE EN PAREDES INTERIORES, INCLUYE PREPARACIÓN DE SUPERFICIE, FONDO SELLADOR Y 2 MANOS DE ACABADO HASTA H=3.00M';
    }
  },
  {
    match: /pared.*bloque|bloque.*pared|pared de bloque/i,
    enrich: (orig) => {
      const e = /e\s*=\s*(\d+)/i.exec(orig);
      const esp = e ? e[1] : '15';
      return `CONSTRUCCIÓN DE PARED DE BLOQUES DE ARCILLA E=${esp}CM, INCLUYE MORTERO DE PEGA 1:4 Y ANDAMIOS HASTA H=3.00M`;
    }
  },
  {
    match: /demoli[c|z]|tumbar|derrib/i,
    enrich: (orig) => {
      const isPared = /pared|muro|tabique/i.test(orig);
      const isPiso = /piso|pavimento/i.test(orig);
      const elem = isPared ? 'PARED DE BLOQUES' : isPiso ? 'PISO DE CONCRETO' : 'ELEMENTO EXISTENTE';
      return `DEMOLICIÓN A MANO DE ${elem}, INCLUYE ACARREO INTERNO Y APILAMIENTO DE ESCOMBROS HASTA SITIO DE DISPOSICIÓN`;
    }
  },
  {
    match: /tuberi[a|as].*agua|tubo.*agua/i,
    enrich: (orig) => {
      const isServ = /servida|negra|residual/i.test(orig);
      return isServ
        ? 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC PARA AGUAS SERVIDAS D=4", INCLUYE ACCESORIOS, PEGA PVC Y PRUEBA DE ESTANQUEIDAD'
        : 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC PARA AGUAS BLANCAS D=1/2", INCLUYE ACCESORIOS, PEGA PVC Y PRUEBA HIDROSTÁTICA';
    }
  },
  {
    match: /impermeabili[z|s]|manto/i,
    enrich: () =>
      'IMPERMEABILIZACIÓN DE LOSA DE TECHO CON MANTO ASFÁLTICO DE 4MM, INCLUYE IMPRIMACIÓN ASFÁLTICA Y 2 MANOS DE PINTURA DE ALUMINIO'
  },
  {
    match: /piso.*ceramica|ceramica/i,
    enrich: () =>
      'SUMINISTRO E INSTALACIÓN DE PISO DE CERÁMICA ESMALTADA DE TRÁFICO MEDIO, INCLUYE PEGO GRIS, CORTES Y EMBOQUILLADO'
  },
  {
    match: /porcelanato/i,
    enrich: () =>
      'SUMINISTRO E INSTALACIÓN DE PISO DE PORCELANATO 60X60CM, INCLUYE PEGO BLANCO ESPECIAL, NIVELADORES Y EMBOQUILLADO'
  },
  {
    match: /bote.*escombro|escombro.*bote|acarreo.*escombro/i,
    enrich: () =>
      'TRANSPORTE Y BOTE DE ESCOMBROS EN CAMIÓN VOLTEO, INCLUYE CARGA MANUAL, TRASLADO Y DISPOSICIÓN FINAL EN BOTADERO AUTORIZADO'
  },
  {
    match: /concreto.*losa|losa.*concreto/i,
    enrich: () =>
      'CONSTRUCCIÓN DE LOSA DE CONCRETO PREMEZCLADO F\'C=250 KG/CM2, INCLUYE VACIADO, VIBRADO Y CURADO'
  },
  {
    match: /cable|cableado|conductor/i,
    enrich: () =>
      'SUMINISTRO E INSTALACIÓN DE CONDUCTOR DE COBRE THW CALIBRE 12 AWG, INCLUYE ENHEBRADO EN TUBERÍA Y CONEXIONES'
  },
  {
    match: /drywall|yeso|tabique durlock/i,
    enrich: () =>
      'CONSTRUCCIÓN DE TABIQUE DE DRYWALL CON LÁMINAS DE YESO DE 1/2" A DOS CARAS, INCLUYE ESTRUCTURA METÁLICA, CINTA Y PASTA DE REMATE'
  }
];

/**
 * Audita una partida individual.
 *
 * @param {string} description - Texto de la partida.
 * @param {string} [cod_par] - Código de la partida si ya proviene de COVENIN.
 * @param {string} [unit] - Unidad de medida.
 * @returns {Object} Diagnóstico con estado, campos faltantes y sugerencia.
 */
export function auditDescription(description = '', cod_par = null, unit = '') {
  const clean = (description || '').trim();

  // Partida vacía
  if (!clean) {
    return {
      status: 'empty',
      label: 'Vacía',
      score: 0,
      missing: ['descripción'],
      suggestion: '',
      isCovenin: false
    };
  }

  // Si proviene de norma oficial COVENIN
  if (cod_par && cod_par.trim() && !/^S\/C/i.test(cod_par)) {
    return {
      status: 'covenin',
      label: 'COVENIN Oficial',
      score: 100,
      missing: [],
      suggestion: clean,
      isCovenin: true
    };
  }

  const cleanLower = clean.toLowerCase();
  const words = cleanLower.split(/\s+/).filter(Boolean);

  const hasAction = ACTION_PATTERNS.some((a) => cleanLower.includes(a.root));
  const hasElement = ELEMENT_PATTERNS.some((e) => cleanLower.includes(e));
  const hasSpec = SPEC_REGEX.test(cleanLower);
  const hasScope = /incluye|incluyendo|con mortero|con acabado|hasta h=|suministro e instalaci|a dos caras/i.test(cleanLower);

  const missing = [];
  if (!hasAction) missing.push('acción constructiva');
  if (!hasElement) missing.push('elemento constructivo');
  if (!hasSpec) missing.push('especificación o espesor');

  // Si tiene al menos 5 palabras técnicas y especificación clara, es completa
  const isDetailed = (hasAction && hasElement && (hasSpec || hasScope)) || (words.length >= 7 && (hasSpec || hasScope));

  if (isDetailed) {
    return {
      status: 'complete',
      label: 'S/C Completa',
      score: 90,
      missing: [],
      suggestion: clean,
      isCovenin: false
    };
  }

  // Partida ambigua o incompleta
  const suggestion = generateEnrichedSuggestion(clean, unit);
  return {
    status: 'warning',
    label: 'Incompleta',
    score: hasElement && hasAction ? 55 : 30,
    missing: missing.length > 0 ? missing : ['especificación técnica detallada'],
    suggestion: suggestion,
    isCovenin: false
  };
}

/**
 * Genera una sugerencia enriquecida estructurada a partir de una descripción breve.
 *
 * @param {string} raw - Descripción original.
 * @param {string} [unit] - Unidad de medida.
 * @returns {string} Descripción enriquecida.
 */
export function generateEnrichedSuggestion(raw = '', unit = '') {
  const clean = (raw || '').trim();
  if (!clean) return '';

  for (const t of CANONICAL_TEMPLATES) {
    if (t.match.test(clean)) {
      return t.enrich(clean);
    }
  }

  // Regla general para otras actividades constructivas
  const cleanUpper = clean.toUpperCase();
  const includesText = 'INCLUYE MATERIALES, HERRAMIENTAS MENORES Y MANO DE OBRA ESPECIALIZADA';

  // Si ya empieza con una acción conocida
  const startsWithAction = /^(SUMINISTRO|CONSTRUCCI|DEMOLICI|INSTALACI|APLICACI|VACIADO|DESMONTE|ACARREO|LIMPIEZA|REPARACI)/i.test(cleanUpper);
  if (startsWithAction) {
    if (!/INCLUYE/i.test(cleanUpper)) {
      return `${cleanUpper}, ${includesText}`;
    }
    return cleanUpper;
  }

  // Agregar acción estándar por defecto según el contexto
  return `SUMINISTRO E INSTALACIÓN DE ${cleanUpper}, ${includesText}`;
}
