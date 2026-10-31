/**
 * Auditor Semántico y Enriquecedor de Descripciones Técnicas para APUs.
 *
 * Evalúa si una partida posee la información constructiva necesaria
 * (Acción, Elemento, Especificaciones Técnicas y Alcance) antes de
 * pasar al generador de APUs con IA, detectando y resolviendo la
 * ambigüedad en los materiales constructivos para evitar alucinaciones.
 */

export const ACTION_PATTERNS = [
  { root: 'demol', label: 'Demolición' },
  { root: 'remoc', label: 'Remoción' },
  { root: 'remov', label: 'Remoción' },
  { root: 'retir', label: 'Retiro' },
  { root: 'desmont', label: 'Desmontaje' },
  { root: 'desarm', label: 'Desarme' },
  { root: 'desvalij', label: 'Desvalijamiento' },
  { root: 'tumbar', label: 'Demolición' },
  { root: 'derrib', label: 'Demolición' },
  { root: 'picar', label: 'Picado / Remoción' },
  { root: 'picad', label: 'Picado' },
  { root: 'desmantel', label: 'Desmantelamiento' },
  { root: 'extracc', label: 'Extracción' },
  { root: 'tala', label: 'Tala' },
  { root: 'poda', label: 'Poda' },
  { root: 'deshierb', label: 'Deshierbe' },
  { root: 'desmalez', label: 'Desmalezado' },
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
  { root: 'compact', label: 'Compactación' },
  { root: 'bache', label: 'Bacheo' },
  { root: 'fresad', label: 'Fresado' },
  { root: 'carg', label: 'Carga' }
];

export const ELEMENT_PATTERNS = [
  'pared', 'muro', 'tabique', 'bloque', 'ladrillo', 'concreto', 'viga', 'columna',
  'zapata', 'fundacion', 'cimiento', 'piso', 'ceramica', 'porcelanato', 'granito',
  'tuberia', 'tubo', 'pvc', 'acero', 'hierro', 'metalic', 'baranda', 'escalera',
  'bomba', 'tanque', 'valvula', 'puerta', 'marco', 'madera', 'ventana', 'reja', 'porton',
  'techo', 'cielorraso', 'cubierta', 'mortero', 'friso', 'escombro', 'tierra', 'zanja',
  'cabilla', 'malla', 'tablero', 'cable', 'conductor', 'luminaria', 'lampara',
  'tomacorriente', 'interruptor', 'drywall', 'yeso', 'manto', 'asfalto',
  'sanitari', 'lavaman', 'pocet', 'inodor', 'urinari', 'griferi', 'cerradur', 'vidri'
];

export const SPEC_REGEX = /(?:e\s*=|espesor|d\s*=|diametro|f'?c|kg\/cm2|psi|calibre|cal\b|\b\d+(?:[.,]\d+)?\s*(?:cm|mm|m\b|"|''|pulg|hp|kva|w\b|btu|kg|ton)|1:\d|caucho|esmalte|epoxic|antioxid|antialcalino|premezclad|arcilla|cemento)/i;

/**
 * Dominios de ambigüedad de materiales con sus variantes constructivas.
 * Permite al usuario desambiguar rápidamente con 1 clic en vez de asumir arbitrariamente.
 */
export const MATERIAL_AMBIGUITY_DOMAINS = [
  {
    id: 'pintura',
    label: 'Tipo de pintura / Acabado',
    match: /pintura|pintar|esmalte|fondear/i,
    variants: [
      {
        name: 'Caucho Interior (Mate)',
        text: 'APLICACIÓN DE PINTURA DE CAUCHO MATE EN PAREDES INTERIORES, INCLUYE PREPARACIÓN DE SUPERFICIE, FONDO SELLADOR Y 2 MANOS DE ACABADO HASTA H=3.00M'
      },
      {
        name: 'Caucho Exterior (Fachadas)',
        text: 'APLICACIÓN DE PINTURA DE CAUCHO ELASTOMÉRICA PARA EXTERIORES EN FACHADAS, INCLUYE FONDO ANTIALCALINO Y 2 MANOS DE ACABADO'
      },
      {
        name: 'Esmalte Sintético (Herrería/Rejas)',
        text: 'APLICACIÓN DE PINTURA DE ESMALTE SINTÉTICO EN SUPERFICIES METÁLICAS, INCLUYE LIJADO, FONDO ANTICORROSIVO Y 2 MANOS DE ESMALTE'
      },
      {
        name: 'Epóxica de Alto Tráfico',
        text: 'APLICACIÓN DE PINTURA EPÓXICA DE DOS COMPONENTES EN PISOS O MUROS, INCLUYE PREPARACIÓN QUÍMICA DE SUPERFICIE Y 2 MANOS DE ACABADO'
      }
    ]
  },
  {
    id: 'pared_bloque',
    label: 'Tipo de bloque y espesor',
    match: /pared.*bloque|bloque.*pared|pared de bloque|levantamiento de pared|bloque/i,
    variants: [
      {
        name: 'Bloque Arcilla e=15cm',
        text: 'CONSTRUCCIÓN DE PARED DE BLOQUES DE ARCILLA E=15CM, INCLUYE MORTERO DE PEGA 1:4 Y ANDAMIOS HASTA H=3.00M'
      },
      {
        name: 'Bloque Arcilla e=10cm',
        text: 'CONSTRUCCIÓN DE PARED DE BLOQUES DE ARCILLA E=10CM, INCLUYE MORTERO DE PEGA 1:4 Y ANDAMIOS HASTA H=3.00M'
      },
      {
        name: 'Bloque Concreto e=15cm',
        text: 'CONSTRUCCIÓN DE PARED DE BLOQUES DE CONCRETO E=15CM, INCLUYE MORTERO DE PEGA 1:4 Y ANDAMIOS HASTA H=3.00M'
      },
      {
        name: 'Bloque Concreto e=20cm (Carga)',
        text: 'CONSTRUCCIÓN DE PARED DE BLOQUES DE CONCRETO E=20CM, INCLUYE MORTERO DE PEGA 1:4 Y ANDAMIOS HASTA H=3.00M'
      }
    ]
  },
  {
    id: 'tuberia_agua',
    label: 'Servicio y diámetro de tubería',
    match: /tuberi[a|as]|tubo.*agua|plomeri[a|as]/i,
    variants: [
      {
        name: 'Aguas Blancas PVC 1/2"',
        text: 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC PARA AGUAS BLANCAS D=1/2", INCLUYE CONEXIONES, SOLDADURA LÍQUIDA Y PRUEBA HIDROSTÁTICA'
      },
      {
        name: 'Aguas Blancas PVC 3/4"',
        text: 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC PARA AGUAS BLANCAS D=3/4", INCLUYE CONEXIONES, SOLDADURA LÍQUIDA Y PRUEBA HIDROSTÁTICA'
      },
      {
        name: 'Aguas Servidas PVC 4"',
        text: 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC PARA AGUAS SERVIDAS D=4", INCLUYE ACCESORIOS, PEGA PVC Y PRUEBA DE ESTANQUEIDAD'
      },
      {
        name: 'Aguas Servidas PVC 2"',
        text: 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC PARA AGUAS SERVIDAS D=2", INCLUYE ACCESORIOS, PEGA PVC Y PRUEBA DE ESTANQUEIDAD'
      },
      {
        name: 'Termofusión PPR 20mm (1/2")',
        text: 'SUMINISTRO E INSTALACIÓN DE TUBERÍA DE POLIPROPILENO (TERMOFUSIÓN) D=20MM PARA AGUA FRÍA/CALIENTE, INCLUYE ACCESORIOS Y PRUEBA'
      }
    ]
  },
  {
    id: 'friso',
    label: 'Acabado y ubicación del friso',
    match: /friso|revoque|tarrajeo/i,
    variants: [
      {
        name: 'Liso Interior Mortero 1:4',
        text: 'CONSTRUCCIÓN DE FRISO ACABADO LISO EN PAREDES INTERIORES, INCLUYE MORTERO 1:4, REMATE DE ARISTAS Y ANDAMIOS HASTA H=3.00M'
      },
      {
        name: 'Rústico / Salpicado Base',
        text: 'CONSTRUCCIÓN DE FRISO ACABADO RÚSTICO O SALPICADO BASE PARA RECIBIR REVESTIMIENTOS, INCLUYE MORTERO 1:3'
      },
      {
        name: 'Exterior con Hidrófugo',
        text: 'CONSTRUCCIÓN DE FRISO ACABADO LISO EN PAREDES EXTERIORES, INCLUYE ADITIVO HIDRÓFUGO, MORTERO 1:4 Y ANDAMIOS'
      }
    ]
  },
  {
    id: 'pisos',
    label: 'Tipo de piso / Revestimiento',
    match: /piso|porcelanato|ceramica|caico|granito/i,
    variants: [
      {
        name: 'Cerámica Esmaltada Tráfico Medio',
        text: 'SUMINISTRO E INSTALACIÓN DE PISO DE CERÁMICA ESMALTADA DE TRÁFICO MEDIO, INCLUYE PEGO GRIS, CORTES Y EMBOQUILLADO'
      },
      {
        name: 'Porcelanato 60x60 Rectificado',
        text: 'SUMINISTRO E INSTALACIÓN DE PISO DE PORCELANATO 60X60CM RECTIFICADO, INCLUYE PEGO BLANCO ESPECIAL, NIVELADORES Y EMBOQUILLADO'
      },
      {
        name: 'Cemento Pulido e=5cm',
        text: 'CONSTRUCCIÓN DE PISO DE CONCRETO CON ACABADO EN CEMENTO PULIDO DE 5CM DE ESPESOR, INCLUYE JUNTAS DE DILATACIÓN'
      },
      {
        name: 'Caico Criollo 20x20',
        text: 'SUMINISTRO E INSTALACIÓN DE PISO DE CAICO CRIOLLO DE ARCILLA 20X20CM, INCLUYE MORTERO DE ASIENTO 1:4 Y EMBOQUILLADO'
      }
    ]
  },
  {
    id: 'impermeabilizacion',
    label: 'Sistema de impermeabilización',
    match: /impermeabili|manto/i,
    variants: [
      {
        name: 'Manto Asfáltico 4mm + Aluminio',
        text: 'IMPERMEABILIZACIÓN DE LOSA DE TECHO CON MANTO ASFÁLTICO DE 4MM, INCLUYE IMPRIMACIÓN ASFÁLTICA Y 2 MANOS DE PINTURA DE ALUMINIO'
      },
      {
        name: 'Manto Asfáltico 3mm',
        text: 'IMPERMEABILIZACIÓN DE TECHO CON MANTO ASFÁLTICO DE 3MM, INCLUYE IMPRIMER ASFÁLTICO Y SELLADO DE TRASLAPES'
      },
      {
        name: 'Membrana Líquida Elastomérica',
        text: 'IMPERMEABILIZACIÓN CON MEMBRANA LÍQUIDA ELASTOMÉRICA EN 3 MANOS CON MALLA DE REFUERZO DE POLIÉSTER'
      }
    ]
  },
  {
    id: 'demolicion',
    label: 'Elemento a demoler',
    match: /demoli|tumbar|derrib|picar/i,
    variants: [
      {
        name: 'Pared de Bloques',
        text: 'DEMOLICIÓN A MANO DE PARED DE BLOQUES DE ARCILLA O CONCRETO HASTA H=3.00M, INCLUYE ACARREO INTERNO Y APILAMIENTO DE ESCOMBROS'
      },
      {
        name: 'Piso de Concreto hasta e=10cm',
        text: 'DEMOLICIÓN CON MARTILLO NEUMÁTICO DE PISO DE CONCRETO HASTA E=10CM, INCLUYE BOTE INTERNO DE ESCOMBROS'
      },
      {
        name: 'Concreto Armado',
        text: 'DEMOLICIÓN DE ELEMENTO DE CONCRETO ARMADO CON MARTILLO DE IMPACTO, INCLUYE CORTE DE CABILLAS Y APILAMIENTO'
      },
      {
        name: 'Tabique Drywall',
        text: 'DESMONTE Y DEMOLICIÓN DE TABIQUERÍA DE DRYWALL/YESO, INCLUYE ESTRUCTURA METÁLICA Y DESALOJO DE ESCOMBROS'
      }
    ]
  },
  {
    id: 'electricidad',
    label: 'Tipo de punto eléctrico',
    match: /electric|punto.*luz|tomacorriente|iluminacion|cable/i,
    variants: [
      {
        name: 'Tomacorriente 110V',
        text: 'SUMINISTRO E INSTALACIÓN DE PUNTO DE TOMACORRIENTE DOBLE 110V POLARIZADO, INCLUYE TUBERÍA EMT 1/2", CONDUCTORES THW #12 Y TAPA'
      },
      {
        name: 'Iluminación / Salida Techo',
        text: 'SUMINISTRO E INSTALACIÓN DE PUNTO DE ILUMINACIÓN DE TECHO, INCLUYE TUBERÍA CONDUIT 1/2", CABLE THW #12, INTERRUPTOR Y CAJA OCTOGONAL'
      },
      {
        name: 'Punto 220V (A/A - Cocina)',
        text: 'SUMINISTRO E INSTALACIÓN DE PUNTO PARA AIRE ACONDICIONADO 220V, INCLUYE CABLE THW #10, TOMA NEMA Y BREAKER DE PROTECCIÓN'
      }
    ]
  },
  {
    id: 'drywall',
    label: 'Tipo de tabique liviano',
    match: /drywall|yeso|durlock/i,
    variants: [
      {
        name: 'Yeso 1/2" Dos Caras',
        text: 'CONSTRUCCIÓN DE TABIQUE DE DRYWALL CON LÁMINAS DE YESO DE 1/2" A DOS CARAS, INCLUYE ESTRUCTURA METÁLICA, CINTA Y PASTA'
      },
      {
        name: 'Yeso Una Cara (Forrado)',
        text: 'FORRADO DE MURO CON LÁMINAS DE YESO DE 1/2" A UNA CARA, INCLUYE ESTRUCTURA METÁLICA Y PASTA DE REMATE'
      },
      {
        name: 'Lámina RH Resistente a Humedad (Baños)',
        text: 'CONSTRUCCIÓN DE TABIQUE DE DRYWALL CON LÁMINAS RH VERDES DE 1/2" A DOS CARAS PARA ZONAS HÚMEDAS Y BAÑOS'
      }
    ]
  }
];

/**
 * Busca si la descripción encaja en un dominio de material ambiguo.
 *
 * @param {string} text - Descripción de la partida.
 * @returns {Object|null} Dominio de ambigüedad si aplica.
 */
export function getMaterialAmbiguityDomain(text = '') {
  if (!text) return null;
  const clean = text.trim();
  const cleanLower = clean.toLowerCase();

  // Si la actividad es demolición, remoción, picado, desmonte, retiro o bote,
  // NUNCA aplican los dominios de suministro/instalación de materiales nuevos
  // (ej: demoler cerámica NO requiere elegir si es porcelanato o caico).
  const isDemolitionOrRemoval = /remoc|remov|retir|desmont|desarm|demol|tumbar|derrib|picar|picad|desmantel|extracc|tala|poda|deshierb|desmalez|bote|botar|acarr|limpiez/i.test(cleanLower);

  if (isDemolitionOrRemoval) {
    // Si la descripción de demolición es sumamente escueta (< 4 palabras, ej: "DEMOLICIÓN")
    const words = cleanLower.split(/\s+/).filter(Boolean);
    if (words.length <= 3) {
      return MATERIAL_AMBIGUITY_DOMAINS.find((d) => d.id === 'demolicion') || null;
    }
    return null;
  }

  for (const dom of MATERIAL_AMBIGUITY_DOMAINS) {
    if (dom.id === 'demolicion') continue;
    if (dom.match.test(clean)) {
      return dom;
    }
  }
  return null;
}

/**
 * Audita una partida individual detectando la ambigüedad en materiales.
 *
 * @param {string} description - Texto de la partida.
 * @param {string} [cod_par] - Código de la partida si ya proviene de COVENIN.
 * @param {string} [unit] - Unidad de medida.
 * @returns {Object} Diagnóstico con estado, campos faltantes, variantes de material y sugerencia.
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
      isCovenin: false,
      materialDomain: null,
      materialVariants: []
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
      isCovenin: true,
      materialDomain: null,
      materialVariants: []
    };
  }

  const cleanLower = clean.toLowerCase();
  const words = cleanLower.split(/\s+/).filter(Boolean);

  const hasAction = ACTION_PATTERNS.some((a) => cleanLower.includes(a.root));
  const hasElement = ELEMENT_PATTERNS.some((e) => cleanLower.includes(e));
  const hasSpec = SPEC_REGEX.test(cleanLower);
  const hasScope = /incluye|incluyendo|con mortero|con acabado|hasta h=|suministro e instalaci|a dos caras/i.test(cleanLower);

  // Detectar si se trata de una actividad de remoción, demolición, retiro o desmontaje
  const isDemolitionOrRemoval = /remoc|remov|retir|desmont|desarm|demol|tumbar|derrib|picar|picad|desmantel|extracc|tala|poda|deshierb|desmalez|bote|botar|acarr|limpiez/i.test(cleanLower);

  // Dominio de ambigüedad (no aplica a demoliciones/remociones que ya tengan su alcance destructivo)
  const ambDomain = isDemolitionOrRemoval ? null : getMaterialAmbiguityDomain(clean);

  // Si tiene un dominio de ambigüedad y no contiene ya especificaciones muy detalladas (menos de 8 palabras y sin spec)
  const isMaterialAmbiguous = Boolean(ambDomain && words.length < 8 && !hasSpec);

  const missing = [];
  if (isMaterialAmbiguous) {
    missing.push(`especificar material (${ambDomain.label})`);
  } else {
    if (!hasAction) missing.push('acción constructiva');
    if (!hasElement) missing.push('elemento constructivo');
    // Para actividades de demolición, remoción o desmonte no se exige espesor ni especificación de mezcla
    if (!hasSpec && !isDemolitionOrRemoval) missing.push('especificación o espesor');
  }

  // Si es detallada y no es ambigua
  // Una remoción/demolición que tenga acción y elemento ya es técnicamente completa (ej: "DEMOLICION DE REVESTIMIENTO DE CERAMICA EN PAREDES CON EL USO DE EQUIPOS MANUALES")
  const isDetailed = !isMaterialAmbiguous && (
    (isDemolitionOrRemoval && hasElement && hasAction) ||
    (hasAction && hasElement && (hasSpec || hasScope)) ||
    (words.length >= 7 && (hasSpec || hasScope || isDemolitionOrRemoval))
  );

  if (isDetailed) {
    return {
      status: 'complete',
      label: 'S/C Completa',
      score: 90,
      missing: [],
      suggestion: clean,
      isCovenin: false,
      materialDomain: null,
      materialVariants: []
    };
  }

  // Partida ambigua o incompleta
  const variants = ambDomain ? ambDomain.variants : [];
  const defaultSuggestion = variants.length > 0 ? variants[0].text : generateEnrichedSuggestion(clean, unit);

  return {
    status: 'warning',
    label: isMaterialAmbiguous ? 'Material Ambiguo' : 'Incompleta',
    score: hasElement && hasAction ? 55 : 30,
    missing: missing.length > 0 ? missing : ['especificación técnica detallada'],
    suggestion: defaultSuggestion,
    isCovenin: false,
    materialDomain: ambDomain ? ambDomain.label : null,
    materialVariants: variants
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

  const dom = getMaterialAmbiguityDomain(clean);
  if (dom && dom.variants && dom.variants.length > 0) {
    return dom.variants[0].text;
  }

  const cleanUpper = clean.toUpperCase();

  // Caso 1: Remoción, demolición, desmontaje, retiro, tala, limpieza, bote, etc.
  const isRemovalOrDemo =
    /^(REMOCI|DEMOLICI|DESMONTE|DESMONTAJE|DESARME|RETIRO|PICADO|DESVALIJE|EXTRACCI|TALA|DESMALEZADO|BOTE|ACARREO|LIMPIEZA|DESMANTELAMIENTO)/i.test(cleanUpper) ||
    /\b(REMOCION|DEMOLICION|DESMONTAJE|DESARME|RETIRO|DESMANTELAMIENTO)\b/i.test(cleanUpper);

  if (isRemovalOrDemo) {
    if (/INCLUYE|INCLUYENDO/i.test(cleanUpper)) {
      return cleanUpper;
    }
    // Para actividades de remoción y demolición NUNCA se suministran ni instalan materiales
    return `${cleanUpper}, INCLUYE DESMONTAJE, HERRAMIENTAS MENORES, EQUIPO DE PROTECCIÓN Y TRASLADO HASTA SITIO DE ACOPIO O BOTE`;
  }

  // Caso 2: Ya comienza con cualquier otra acción constructiva (construcción, aplicación, pintura, vaciado, etc.)
  const startsWithAction = /^(SUMINISTRO|CONSTRUCCI|INSTALACI|APLICACI|VACIADO|COLOCACI|MONTAJE|FABRICACI|ARMADO|ENCOFRADO|FRISO|REVOQUE|REPARACI|REHABILITACI|IMPERMEABILIZACI|PINTURA|REPLANTEO|NIVELACI|COMPACTACI|EXCAVACI)/i.test(cleanUpper);
  if (startsWithAction) {
    if (!/INCLUYE|INCLUYENDO/i.test(cleanUpper)) {
      return `${cleanUpper}, INCLUYE MATERIALES, HERRAMIENTAS MENORES Y MANO DE OBRA ESPECIALIZADA`;
    }
    return cleanUpper;
  }

  // Caso 3: Solo si es un elemento desnudo sin verbo de acción inicial (ej: "LÁMPARA LED", "PUERTA ENTAMBORADA")
  return `SUMINISTRO E INSTALACIÓN DE ${cleanUpper}, INCLUYE MATERIALES, HERRAMIENTAS MENORES Y MANO DE OBRA ESPECIALIZADA`;
}
