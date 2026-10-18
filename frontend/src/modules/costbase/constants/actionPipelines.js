/**
 * actionPipelines.js
 * Definición de Rutas Dinámicas y Adaptativas para los 23 chips de acción constructiva.
 * Cada acción define su propio orden natural de preguntas, chips contextuales y formateo técnico.
 */

export const ACCIONES_STEP1_CHIPS = [
  'Suministro e instalación',
  'Instalación',
  'Construcción',
  'Demolición',
  'Remoción',
  'Pintura',
  'Vaciado de concreto',
  'Excavación',
  'Compactación',
  'Relleno',
  'Acarreo',
  'Transporte',
  'Deforestación',
  'Colocación',
  'Reparación',
  'Mantenimiento',
  'Restauración',
  'Saneamiento',
  'Confección',
  'Tratamiento',
  'Impermeabilización',
  'Desmontaje',
  'Limpieza'
];

/**
 * Filtro para verificar si un valor fue omitido
 */
export function isOmitted(val) {
  if (!val) return true;
  const lower = val.trim().toLowerCase();
  return lower === 'omitir' || lower === 'ninguno' || lower === 'ninguno / omitir' || lower === 'sugerir por ia' || lower === 'sugerir';
}

/**
 * Normaliza y limpia una unidad de medida seleccionada
 */
export function extractCleanUnit(unitText) {
  if (!unitText || isOmitted(unitText)) return null;
  let raw = unitText.includes('(') ? unitText.split('(')[0].trim() : unitText.trim();
  if (raw === 'm²') return 'm2';
  if (raw === 'm³') return 'm3';
  return raw.toLowerCase();
}

/**
 * Catálogo de pipelines adaptativos por acción
 */
export const ACTION_FLOW_PIPELINES = {
  // 1. COMPACTACIÓN (Método primero)
  compactacion: [
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método o Equipo de Compactación\n¿Con qué equipo o procedimiento se compactará?',
      chips: () => [
        'Manual (con pisón liviano)',
        'Con vibrocompactador (rana / canguro)',
        'Con rodillo vibratorio manual',
        'Con rodillo autopropulsado pesado',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Manual') || v.startsWith('Con ') ? v.toLowerCase() : `compactado con ${v.toLowerCase()}`)
    },
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina la Zona o Capa a Compactar\n¿Qué base, fondo o relleno se va a compactar?',
      chips: () => [
        'Fondo de zanja para tuberías',
        'Relleno de fundaciones / zapatas',
        'Subbase de piso / pavimento',
        'Base granular',
        'Terraplén vial',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'control',
      field: 'incluye',
      text: 'Defina el Espesor de Capa y Control de Calidad\n¿Qué espesor de capa y grado de compactación contempla?',
      chips: () => [
        'En capas de 15 cm al 95% Proctor Modificado',
        'En capas de 20 cm al 95% Proctor Modificado',
        'En capas de 30 cm al 95% Proctor Modificado',
        'En capas compactadas de 20 cm',
        'Al 95% del Proctor Modificado',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la compactación?',
      chips: () => ['m² (Por superficie)', 'm³ (Por volumen compactado)', 'ml (Por metro lineal de zanja)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 2. EXCAVACIÓN (Método primero)
  excavacion: [
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método de Excavación\n¿Cómo se ejecutará la excavación?',
      chips: () => [
        'Manual (a pico y pala)',
        'A máquina con retroexcavadora',
        'A máquina con minishovel / bobcat',
        'Con martillo neumático / compresor',
        'Omitir'
      ],
      format: (v) => (v.startsWith('A ') || v.startsWith('Con ') || v.startsWith('Manual') ? v.toLowerCase() : `con ${v.toLowerCase()}`)
    },
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Tipo de Excavación\n¿Qué elemento o zanja se va a excavar?',
      chips: () => [
        'Zanjas para tuberías',
        'Fundaciones y zapatas',
        'Sótanos / fosas para tanques',
        'Canales de drenaje',
        'Explanaciones masivas',
        'Omitir'
      ],
      format: (v) => `para ${v.toLowerCase()}`
    },
    {
      id: 'profundidad',
      field: 'ubicacion',
      text: 'Defina la Profundidad y Tipo de Terreno\n¿A qué profundidad y en qué tipo de suelo se excavará?',
      chips: () => [
        'Hasta 1.50 m en tierra compacta',
        'De 1.50 a 3.00 m en tierra',
        'Hasta 1.50 m en terreno duro / rocoso',
        'Mayor a 3.00 m a máquina',
        'En roca con martillo neumático',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Hasta ') || v.startsWith('De ') || v.startsWith('En ') || v.startsWith('Mayor') ? v.toLowerCase() : `a profundidad ${v.toLowerCase()}`)
    },
    {
      id: 'alcance_bote',
      field: 'incluye',
      text: 'Defina el Alcance y Disposición de Tierra\n¿Qué contempla la partida respecto al material extraído?',
      chips: () => [
        'Incluye acopio al borde de zanja',
        'Incluye carguío y bote a botadero',
        'Incluye acarreo interno',
        'Solo excavación',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Incluye ') || v.startsWith('Solo ') ? v : `incluye ${v}`)
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la partida?',
      chips: () => ['m³ (Metro cúbico)', 'ml (Metro lineal)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 3. DEMOLICIÓN (Método primero)
  demolicion: [
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método de Demolición\n¿Qué equipo o procedimiento se empleará?',
      chips: () => [
        'Manual (mandarria, cincel y pala)',
        'Con compresor y martillo neumático',
        'Con retroexcavadora y martillo hidráulico',
        'Con cortadora de disco diamantado',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Manual') || v.startsWith('Con ') ? v.toLowerCase() : `con ${v.toLowerCase()}`)
    },
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento a Demoler\n¿Qué estructura o elemento se demolerá?',
      chips: () => [
        'Paredes de bloques',
        'Losas de concreto',
        'Pisos y pavimentos',
        'Vigas y columnas',
        'Aceras y brocales',
        'Estructuras metálicas',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'espesor',
      field: 'ubicacion',
      text: 'Defina el Espesor y Material\n¿Qué espesor o características tiene el elemento?',
      chips: () => [
        'En concreto armado e=10-15 cm',
        'En concreto armado e=20-25 cm',
        'En concreto simple e=10-15 cm',
        'En albañilería de bloques e=15 cm',
        'En albañilería de bloques e=10 cm',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Manejo de Escombros\n¿Qué alcance tiene respecto a los residuos?',
      chips: () => [
        'Incluye desalojo y bote de escombros',
        'Incluye acopio en sitio para bote',
        'Incluye corte y clasificación de cabillas',
        'Solo demolición',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Incluye ') || v.startsWith('Solo ') ? v : `incluye ${v}`)
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la demolición?',
      chips: () => ['m² (Por superficie)', 'm³ (Por volumen demolido)', 'ml (Metro lineal)', 'pza (Por pieza)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 4. REMOCIÓN (Método primero)
  remocion: [
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método de Remoción\n¿Cómo se ejecutará el retiro del elemento?',
      chips: () => [
        'Manual con herramientas menores',
        'Con martillo neumático / compresor',
        'Con retroexcavadora / cargador frontal',
        'Con equipo oxicorte',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Manual') || v.startsWith('Con ') ? v.toLowerCase() : `con ${v.toLowerCase()}`)
    },
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Capa a Remover\n¿Qué elemento o material se va a remover?',
      chips: () => [
        'Capa vegetal / descapote',
        'Pavimento asfáltico',
        'Concreto existente',
        'Tuberías existentes',
        'Cercas perimetrales',
        'Estructuras metálicas',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'condicion',
      field: 'ubicacion',
      text: 'Defina el Espesor o Condición\n¿Qué espesor o entorno presenta?',
      chips: () => [
        'Espesor hasta 10 cm',
        'Espesor de 10 a 20 cm',
        'Espesor mayor a 20 cm',
        'En exteriores / vialidad',
        'En interiores',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de la Remoción\n¿Qué comprende la disposición del material?',
      chips: () => [
        'Incluye carguío y retiro a botadero',
        'Incluye acopio en sitio',
        'Incluye corte perimetral con disco',
        'Solo remoción',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Incluye ') || v.startsWith('Solo ') ? v : `incluye ${v}`)
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la remoción?',
      chips: () => ['m² (Metro cuadrado)', 'm³ (Metro cúbico)', 'ml (Metro lineal)', 'pza (Pieza)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 5. LIMPIEZA (Método primero)
  limpieza: [
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método de Limpieza\n¿Qué procedimiento o equipo se utilizará?',
      chips: () => [
        'Manual con agua, cepillo y escobillón',
        'Con hidrolavadora a alta presión',
        'Química con desengrasante / solvente',
        'Mecánica con minishovel / cuadrilla',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Manual') || v.startsWith('Con ') || v.startsWith('Química') ? v.toLowerCase() : `con ${v.toLowerCase()}`)
    },
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Área o Elemento a Limpiar\n¿Qué superficie o elemento se intervendrá?',
      chips: () => [
        'Pisos y pavimentos',
        'Fachadas y muros exteriores',
        'Tanques de agua potable',
        'Terreno y áreas verdes (desmalezado)',
        'Vidrios y ventanales',
        'Estructuras metálicas',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance y Momento de Limpieza\n¿Qué tipo de limpieza se requiere?',
      chips: () => [
        'Limpieza final de obra para entrega',
        'Desmanchado profundo de superficie',
        'Limpieza periódica en obra',
        'Incluye retiro y desalojo de desechos',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la limpieza?',
      chips: () => ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'und (Por unidad/tanque)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 6. TRANSPORTE (Carga -> Vehículo -> Distancia)
  transporte: [
    {
      id: 'material_carga',
      field: 'elemento',
      text: 'Defina el Material o Carga a Transportar\n¿Qué se va a transportar?',
      chips: () => [
        'Escombros de demolición',
        'Tierra de excavación',
        'Material de préstamo granular (granzón)',
        'Arena lavada y piedra picada',
        'Cemento y bloques de concreto',
        'Maquinaria y equipos',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'vehiculo',
      field: 'material',
      text: 'Defina el Vehículo de Transporte\n¿Qué tipo de camión o vehículo se empleará?',
      chips: () => [
        'En camión volteo 7 m³',
        'En camión volteo 15 m³',
        'En camión plataforma / batea',
        'En camión 350 / chasis',
        'Omitir'
      ],
      format: (v) => (v.startsWith('En ') ? v.toLowerCase() : `en ${v.toLowerCase()}`)
    },
    {
      id: 'distancia',
      field: 'ubicacion',
      text: 'Defina la Distancia del Flete\n¿A qué distancia se realizará el transporte?',
      chips: () => [
        'Distancia hasta 5 km',
        'Distancia hasta 10 km',
        'Distancia hasta 20 km',
        'Distancia hasta 50 km',
        'Distancia mayor a 50 km',
        'Hacia botadero autorizado',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Distancia') || v.startsWith('Hacia') ? v.toLowerCase() : `a distancia ${v.toLowerCase()}`)
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance del Servicio\n¿Qué incluye el flete?',
      chips: () => [
        'Incluye carguío mecánico y descarga',
        'Incluye carguío manual y descarga',
        'Incluye tarifa de peajes y permisos',
        'Solo transporte de carga (flete)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el transporte?',
      chips: () => ['m3xkm (m³ por kilómetro)', 'tonxkm (Tonelada por km)', 'viaje (Por viaje)', 'm³ (Metro cúbico)', 'ton (Tonelada)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 7. ACARREO (Material -> Medio -> Distancia)
  acarreo: [
    {
      id: 'material',
      field: 'elemento',
      text: 'Defina el Material a Acarrear\n¿Qué material se trasladará internamente?',
      chips: () => [
        'Escombros de demolición',
        'Tierra de excavación',
        'Arena lavada y piedra picada',
        'Sacos de cemento',
        'Bloques de arcilla / concreto',
        'Madera de encofrado',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'medio',
      field: 'material',
      text: 'Defina el Medio de Acarreo\n¿Qué medio de traslado se utilizará?',
      chips: () => [
        'A mano en carretilla',
        'A mano en sacos / tobos',
        'En minishovel / bobcat',
        'Con güinche / montacargas de obra',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'distancia_nivel',
      field: 'ubicacion',
      text: 'Defina la Distancia y Desnivel\n¿A qué distancia y en qué nivel se efectuará el acarreo?',
      chips: () => [
        'Distancia hasta 20 metros en planta baja',
        'Distancia hasta 50 metros en planta baja',
        'Distancia hasta 100 metros',
        'Hacia pisos superiores por escaleras',
        'Desde sótano a planta baja',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el acarreo?',
      chips: () => ['m3.m (m³ por metro)', 'm³ (Metro cúbico)', 'sac.m (Saco por metro)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 8. DEFORESTACIÓN (Vegetación -> Método -> Disposición)
  deforestacion: [
    {
      id: 'tipo_vegetacion',
      field: 'elemento',
      text: 'Defina el Tipo de Vegetación y Terreno\n¿Qué tipo de terreno y vegetación se intervendrá?',
      chips: () => [
        'Maleza baja y matorrales',
        'Vegetación media y arbustos densos',
        'Bosque denso con árboles grandes',
        'Troncos, raíces y tocones',
        'En terreno plano',
        'En terreno con pendiente fuerte',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método de Deforestación\n¿Se ejecutará con cuadrilla manual o maquinaria?',
      chips: () => [
        'Manual con cuadrilla (machete, hacha, motosierra)',
        'Mecánico con tractor de orugas (bulldozer)',
        'Mecánico con retroexcavadora',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'disposicion',
      field: 'incluye',
      text: 'Defina la Disposición de la Madera y Maleza\n¿Qué alcance tiene el desraizamiento y acopio?',
      chips: () => [
        'Incluye tala, desraizamiento y apilado',
        'Incluye retiro y bote fuera de obra',
        'Incluye triturado / quema controlada',
        'Solo tala superficial',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la deforestación?',
      chips: () => ['ha (Hectárea)', 'm² (Metro cuadrado)', 'und (Por árbol / tocón)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 9. RELLENO (Zona -> Material -> Compactación)
  relleno: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina la Zona o Elemento a Rellenar\n¿Qué elemento o fosa se va a rellenar?',
      chips: () => [
        'Zanjas para tuberías',
        'Fundaciones y zapatas',
        'Terraplenes',
        'Bases de piso / sobrepiso',
        'Fosas para tanques y sótanos',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'material',
      field: 'material',
      text: 'Defina el Material de Relleno\n¿Con qué material se rellenará?',
      chips: () => [
        'Con material propio de la excavación',
        'Con material de préstamo granular (granzón/base)',
        'Con piedra picada / grava',
        'Con arena lavada',
        'Con tierra seleccionada libre de materia orgánica',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'metodo_compactacion',
      field: 'ubicacion',
      text: 'Defina la Colocación y Compactación\n¿Cómo se colocará y compactará el relleno?',
      chips: () => [
        'Extendido y compactado a mano con pisón',
        'Compactado con vibrocompactador tipo rana / canguro en capas de 20cm',
        'Compactado con rodillo vibratorio',
        'Solo extendido y nivelado sin compactación',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance del Relleno\n¿Incluye suministro del material o acarreo?',
      chips: () => [
        'Incluye suministro de material de préstamo',
        'Incluye acarreo interno y humedecido',
        'Todo incluido (Material + MO + Equipos)',
        'Solo colocación y mano de obra',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el relleno?',
      chips: () => ['m³ (Metro cúbico compactado)', 'm² (Metro cuadrado)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 10. CONSTRUCCIÓN (Elemento -> Material -> Ubicación)
  construccion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Estructura\n¿Qué elemento constructivo se va a edificar?',
      chips: () => [
        'Paredes de bloques',
        'Columnas y vigas de concreto',
        'Losas de concreto armado',
        'Tabiquería de Drywall / yeso',
        'Cercas perimetrales',
        'Aceras y brocales',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'material',
      field: 'material',
      text: 'Defina el Material y Espesor\n¿Qué tipo de material o dosificación se utilizará?',
      chips: () => [
        'Bloque de arcilla e=10 cm',
        'Bloque de arcilla e=15 cm',
        'Bloque de concreto e=15 cm',
        'Bloque de concreto e=20 cm',
        'Ladrillo macizo de arcilla',
        "Concreto armado f'c=250 kg/cm²",
        'Láminas de yeso standard e=1/2"',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') || v.startsWith('en ') ? v.toLowerCase() : `con ${v.toLowerCase()}`)
    },
    {
      id: 'ubicacion',
      field: 'ubicacion',
      text: 'Defina la Ubicación o Nivel\n¿En qué nivel o área se construirá?',
      chips: () => ['En planta baja', 'En pisos superiores', 'En exteriores', 'En sótanos', 'Omitir'],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance y Condiciones\n¿Qué insumos o servicios incluye?',
      chips: () => [
        'Incluye andamios, mortero y mano de obra',
        'Todo incluido (Materiales + Mano de Obra + Equipos)',
        'Solo mano de obra',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la partida?',
      chips: () => ['m² (Metro cuadrado)', 'm³ (Metro cúbico)', 'ml (Metro lineal)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 11. VACIADO DE CONCRETO (Elemento -> Resistencia -> Vaciado)
  vaciado: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento Estructural\n¿En qué elemento se vaciará el concreto?',
      chips: () => [
        'Losas de concreto armado',
        'Columnas',
        'Vigas de carga / amarre',
        'Fundaciones / zapatas',
        'Pavimentos / pisos de concreto',
        'Muros de contención',
        'Brocales y aceras',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'especificacion',
      field: 'material',
      text: 'Defina la Resistencia f\'c y Espesor\n¿Qué calidad de concreto y espesor contempla?',
      chips: () => [
        "Concreto f'c=210 kg/cm²",
        "Concreto f'c=250 kg/cm²",
        "Concreto f'c=280 kg/cm²",
        "Concreto f'c=210 kg/cm² e=10 cm",
        "Concreto f'c=210 kg/cm² e=15 cm",
        "Concreto f'c=250 kg/cm² e=15 cm",
        "Concreto pobre f'c=150 kg/cm²",
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') || v.startsWith('Con ') ? v : `con ${v}`)
    },
    {
      id: 'metodo_vaciado',
      field: 'ubicacion',
      text: 'Defina el Método de Mezclado y Vaciado\n¿Cómo se preparará y colocará el concreto?',
      chips: () => [
        'Mezclado en obra con trompo / mezcladora',
        'Premezclado con camión mixer',
        'Vaciado con bomba de concreto / pluma',
        'Vaciado manual con carretilla y tobos',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance del Vaciado\n¿Qué operaciones adicionales incluye?',
      chips: () => [
        'Incluye vibrado mecánico y curado con agua',
        'Incluye aditivo impermeabilizante / plastificante',
        'Solo colocación y vaciado',
        'Todo incluido (Concreto + MO + Equipos)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el vaciado?',
      chips: () => ['m³ (Metro cúbico)', 'm² (Metro cuadrado)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 12. SUMINISTRO E INSTALACIÓN & INSTALACIÓN (Equipo -> Capacidad -> Montaje)
  instalacion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Equipo o Componente\n¿Qué equipo o elemento específico se instalará?',
      chips: () => [
        'Bomba sumergible para pozo',
        'Bomba de agua centrífuga',
        'Tablero eléctrico de distribución',
        'Tubería de agua potable / desagüe',
        'Cable conductor eléctrico',
        'Transformador de distribución',
        'Piezas sanitarias (inodoro/lavamanos)',
        'Aire acondicionado split',
        'Tanque de agua cilíndrico',
        'Válvula compuerta',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'capacidad',
      field: 'material',
      text: 'Defina la Capacidad o Especificación Técnica\n¿Qué potencia, diámetro o calibre requerido?',
      chips: () => [
        'Potencia 0.5 HP a 2 HP',
        'Potencia 3 HP a 5 HP',
        'Potencia 7.5 HP a 10 HP',
        'Calibre #12 AWG THHN',
        'Calibre #10 AWG THHN',
        'Calibre #8 AWG THHN',
        'Tubería PVC 1/2" a 1"',
        'Tubería PVC 2" a 4"',
        '12,000 a 24,000 BTU',
        'Capacidad 1,000 a 2,000 litros',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'ubicacion',
      field: 'ubicacion',
      text: 'Defina la Ubicación y Montaje\n¿En qué área o condición se instalará?',
      chips: () => [
        'Empotrado en piso o pared',
        'A la vista sobre soportes',
        'En sala de bombas / máquinas',
        'En pozo profundo',
        'En exteriores',
        'En red de distribución general',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de la Instalación\n¿Qué pruebas o accesorios incluye?',
      chips: () => [
        'Incluye conexiones, accesorios y soportes',
        'Incluye pruebas de presión y certificación',
        'Incluye puesta en marcha y calibración',
        'Solo instalación y mano de obra',
        'Todo incluido (Suministro + Montaje + Pruebas)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la partida?',
      chips: () => ['und (Unidad)', 'pza (Pieza)', 'pto (Punto)', 'ml (Metro lineal)', 'jgo (Juego)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 13. PINTURA (Superficie -> Tipo -> Manos -> Altura)
  pintura: [
    {
      id: 'superficie',
      field: 'elemento',
      text: 'Defina la Superficie a Pintar\n¿Qué elemento o superficie se va a recubrir?',
      chips: () => [
        'Paredes interiores',
        'Paredes y fachadas exteriores',
        'Cielos rasos',
        'Rejas y herrería metálica',
        'Estructuras metálicas / perfiles',
        'Pisos y pavimentos de concreto',
        'Brocales y demarcación vial',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'tipo_pintura',
      field: 'material',
      text: 'Defina el Tipo de Pintura o Acabado\n¿Qué recubrimiento se aplicará?',
      chips: () => [
        'Pintura de caucho clase A',
        'Pintura de caucho clase B',
        'Pintura esmalte sintético brillante',
        'Fondo anticorrosivo alquídico',
        'Fondo cromato de zinc',
        'Pintura epóxica alto tráfico',
        'Pintura elastomérica antihongos',
        'Pintura de tráfico / vial',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') ? v : `con ${v}`)
    },
    {
      id: 'manos_fondo',
      field: 'incluye',
      text: 'Defina el Número de Manos y Preparación\n¿Qué preparación de fondo y capas contempla?',
      chips: () => [
        'A 2 manos de acabado con fondo fijador',
        'A 2 manos con fondo anticorrosivo',
        'A 2 manos con lija y empastado de grietas',
        'A 3 manos de acabado',
        'A 1 mano de fondo y 2 manos de acabado',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'altura',
      field: 'ubicacion',
      text: 'Defina la Altura y Entorno\n¿A qué altura o condiciones se pintará?',
      chips: () => [
        'En interiores planta baja',
        'En exteriores con andamios tubulares',
        'A rapel con cuerdas de seguridad',
        'En pisos superiores',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la pintura?',
      chips: () => ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'pza (Pieza)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 14. IMPERMEABILIZACIÓN (Elemento -> Sistema -> Capas)
  impermeabilizacion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina la Zona o Elemento a Impermeabilizar\n¿Dónde se aplicará el sistema hidrófugo?',
      chips: () => [
        'Losa de techo / azotea',
        'Terrazas transitables',
        'Jardineras',
        'Muros enterrados de contención',
        'Tanques de agua potable',
        'Canaletas de drenaje',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'sistema',
      field: 'material',
      text: 'Defina el Sistema Impermeabilizante\n¿Qué tipo de manto o membrana se empleará?',
      chips: () => [
        'Manto asfáltico 3 mm',
        'Manto asfáltico 4 mm',
        'Manto con acabado de foil de aluminio',
        'Membrana líquida elastomérica con malla',
        'Mortero hidrófugo bicomponente',
        'Primer imprimador asfáltico',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') ? v : `con ${v}`)
    },
    {
      id: 'acabado',
      field: 'incluye',
      text: 'Defina la Preparación y Acabado\n¿Qué capas adicionales contempla?',
      chips: () => [
        'Incluye imprimación con primer y soplete',
        'Incluye pintura reflectiva de aluminio',
        'A 2 capas con velo de poliéster',
        'Todo incluido (Primer + Manto + Soplete)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará?',
      chips: () => ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 15. COLOCACIÓN (Elemento -> Fijación -> Alcance)
  colocacion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento a Colocar\n¿Qué acabado o elemento se instalará?',
      chips: () => [
        'Porcelanato de 60x60 cm',
        'Cerámica de 30x30 cm',
        'Piezas sanitarias (inodoro/lavamanos)',
        'Puertas entamboradas y marcos',
        'Ventanas de aluminio y vidrio',
        'Malla electrosoldada',
        'Techos de láminas de zinc / acerolit',
        'Brocales y adoquines',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'material_fijacion',
      field: 'material',
      text: 'Defina el Material de Fijación / Pegado\n¿Con qué mortero o fijación se colocará?',
      chips: () => [
        'Con mortero adhesivo / pega especial porcelanato',
        'Con mortero adhesivo para cerámica',
        'Con mezcla cemento-arena proporción 1:3',
        'Con tornillos autorroscantes y ramplug',
        'Con espuma de poliuretano y anclajes',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de la Colocación\n¿Qué terminación contempla?',
      chips: () => [
        'Incluye emboquillado / pastina en juntas',
        'Incluye nivelación y corte de piezas',
        'Solo colocación y mano de obra',
        'Todo incluido (Pega + Emboquillado + MO)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará?',
      chips: () => ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'pza (Pieza)', 'und (Unidad)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 16. DESMONTAJE (Elemento -> Condición -> Alcance)
  desmontaje: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento a Desmontar\n¿Qué elemento o instalación se retirará?',
      chips: () => [
        'Techo de láminas / correas metálicas',
        'Puertas y ventanas existentes',
        'Estructuras metálicas / rejas',
        'Luminarias y conductores eléctricos',
        'Tuberías y piezas sanitarias',
        'Equipos de aire acondicionado',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'condicion',
      field: 'material',
      text: 'Defina el Destino y Cuidado del Material\n¿Se recuperará el elemento o es desecho?',
      chips: () => [
        'Con recuperación del material (para reutilizar)',
        'Sin recuperación de material (desecho)',
        'En altura con andamios',
        'En planta baja',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance del Desmontaje\n¿Incluye bajada y acopio?',
      chips: () => [
        'Incluye bajada cuidadosa y apilado en sitio',
        'Incluye retiro y desalojo a botadero',
        'Solo desmontaje en sitio',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el desmontaje?',
      chips: () => ['m² (Metro cuadrado)', 'pza (Pieza)', 'und (Unidad)', 'ml (Metro lineal)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 17. REPARACIÓN & MANTENIMIENTO (Elemento -> Tarea -> Material)
  reparacion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Sistema a Reparar / Mantener\n¿Qué estructura o equipo se intervendrá?',
      chips: () => [
        'Paredes y frisos con grietas / humedad',
        'Tuberías y fugas hidrosanitarias',
        'Estructuras de concreto fisuradas',
        'Bombas de agua y motores eléctricos',
        'Estructuras metálicas y techos',
        'Tableros eléctricos y acometidas',
        'Pisos y juntas de pavimento',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'diagnostico_metodo',
      field: 'material',
      text: 'Defina la Tarea Técnica y Material\n¿Qué procedimiento o repuesto se empleará?',
      chips: () => [
        'Resane con mortero tixotrópico de reparación',
        'Inyección de resina epóxica en grietas',
        'Sustitución de tramo de tubería y accesorios',
        'Cambio de sellos, rodamientos e impulsores',
        'Pintura y sellador anticorrosivo',
        'Ajuste de bornes y reemplazo de breakes',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') || v.startsWith('Resane') || v.startsWith('Inyección') || v.startsWith('Sustitución') || v.startsWith('Cambio') ? v.toLowerCase() : `con ${v.toLowerCase()}`)
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance y Pruebas\n¿Incluye pruebas de funcionamiento?',
      chips: () => [
        'Incluye pruebas de funcionamiento y puesta en marcha',
        'Incluye preparación y picado de superficie dañada',
        'Todo incluido (Repuestos + MO + Equipos)',
        'Solo mano de obra especializada',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará?',
      chips: () => ['pza (Pieza)', 'und (Unidad)', 'pto (Punto)', 'ml (Metro lineal)', 'm² (Metro cuadrado)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 18. RESTAURACIÓN (Elemento -> Intervención -> Material)
  restauracion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento Arquitectónico o Patrimonial\n¿Qué elemento histórico o deteriorado se restaurará?',
      chips: () => [
        'Fachadas históricas y molduras',
        'Estructuras de concreto antiguo',
        'Portones y carpintería de madera noble',
        'Herrería colonial y forja artística',
        'Muros de mampostería / adobe / tapia',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'intervencion',
      field: 'material',
      text: 'Defina el Tipo de Intervención\n¿Qué técnica de restauración se ejecutará?',
      chips: () => [
        'Consolidación estructural y resane de grietas',
        'Limpieza suave no abrasiva / química controlada',
        'Reposición artesanal de molduras faltantes',
        'Tratamiento consolidante y fijador',
        'Decapado y reintegración cromática',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'material',
      field: 'ubicacion',
      text: 'Defina los Materiales de Restauración\n¿Qué morteros o productos especializados se utilizarán?',
      chips: () => [
        'Morteros a base de cal hidráulica natural',
        'Resinas epóxicas de inyección estructural',
        'Preservantes y aceites naturales para madera',
        'Inhibidores de corrosión y pasivadores de metal',
        'Pinturas de silicato transpirables',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') ? v : `con ${v}`)
    },
    {
      id: 'altura_entorno',
      field: 'incluye',
      text: 'Defina la Ubicación y Seguridad\n¿En qué condiciones de trabajo se ejecutará?',
      chips: () => [
        'En fachada con andamios certificados',
        'En interiores de edificación',
        'En altura con arnés y líneas de vida',
        'A nivel de suelo',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la restauración?',
      chips: () => ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'pza (Pieza)', 'und (Unidad)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 19. SANEAMIENTO (Problema -> Método -> Sustitución)
  saneamiento: [
    {
      id: 'zona_problema',
      field: 'elemento',
      text: 'Defina la Zona o Problema a Sanear\n¿Qué sector o patología se intervendrá?',
      chips: () => [
        'Terreno saturado / barro en fondo de excavación',
        'Muros con salitre y humedad ascendente',
        'Colectores y drenajes colapsados',
        'Fosas sépticas / trampas de grasa',
        'Taludes y bermas inestables',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método de Saneamiento\n¿Cómo se procederá a desinfectar, drenar o sanear?',
      chips: () => [
        'Achique continuo con bomba sumergible y dragado manual',
        'Excavación y retiro con retroexcavadora',
        'Picado de friso contaminado, cepillado y lavado',
        'Desinfección profunda y aplicación de bactericida',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') || v.startsWith('Achique') || v.startsWith('Excavación') || v.startsWith('Picado') || v.startsWith('Desinfección') ? v : `con ${v}`)
    },
    {
      id: 'sustitucion',
      field: 'incluye',
      text: 'Defina la Sustitución o Solución\n¿Con qué material se repondrá o estabilizará la zona?',
      chips: () => [
        'Reemplazo con piedra picada y geotextil (pedraplén)',
        'Mortero hidrófugo impermeabilizante de alta densidad',
        'Instalación de nueva tubería PVC de desagüe',
        'Relleno con tierra seleccionada compactada',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Reemplazo') || v.startsWith('Instalación') || v.startsWith('Relleno') || v.startsWith('con ') ? v : `mediante ${v}`)
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el saneamiento?',
      chips: () => ['m³ (Metro cúbico)', 'm² (Metro cuadrado)', 'ml (Metro lineal)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 20. CONFECCIÓN (Elemento -> Material/Calibre -> Lugar)
  confeccion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento a Confeccionar\n¿Qué pieza o armadura se elaborará?',
      chips: () => [
        'Armaduras de cabilla / acero de refuerzo',
        'Formaletas y encofrados de madera',
        'Estructuras metálicas / rejas y portones',
        'Ductos de aire en lámina galvanizada',
        'Canaletas y bajantes de lluvia',
        'Piezas especiales de herrería',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'material_calibre',
      field: 'material',
      text: 'Defina el Material y Calibre\n¿Qué tipo de acero, madera o lámina se utilizará?',
      chips: () => [
        'Cabillas corrugadas grado 60 (fy=4200 kg/cm²)',
        'Madera cepillada y tablero fenólico marino',
        'Perfiles tubulares y ángulos de hierro pulido',
        'Lámina galvanizada calibre 22 a 26',
        'Alambre negro recocido #16 y soldadura 6013',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') ? v : `con ${v}`)
    },
    {
      id: 'lugar_hechura',
      field: 'ubicacion',
      text: 'Defina el Lugar y Entorno de Hechura\n¿Dónde se confeccionará?',
      chips: () => [
        'En banco de trabajo / taller en obra',
        'En taller externo especializado',
        'En sitio directo de colocación',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la confección?',
      chips: () => ['kgf (Kilogramo fuerza / peso de acero)', 'm² (Metro cuadrado de encofrado/ducto)', 'pza (Pieza)', 'ml (Metro lineal)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 21. TRATAMIENTO (Sustrato -> Tipo -> Método)
  tratamiento: [
    {
      id: 'sustrato',
      field: 'elemento',
      text: 'Defina el Sustrato o Elemento a Tratar\n¿Qué superficie o material recibirá el tratamiento?',
      chips: () => [
        'Pisos de concreto / pavimentos industriales',
        'Estructuras metálicas / perfiles de acero',
        'Madera de encofrado / techos machihembrados',
        'Muros de contención y fundaciones',
        'Juntas de dilatación y construcción',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'tipo_tratamiento',
      field: 'material',
      text: 'Defina el Tipo de Tratamiento\n¿Qué sustancia o protección se aplicará?',
      chips: () => [
        'Anticorrosivo / Sandblasting a metal blanco',
        'Sellador hidrófugo siliconado repelente al agua',
        'Antitérmitas y preservante insecticida para madera',
        'Endurecedor superficial y densificador antipolvo',
        'Membrana de curado químico para concreto fresco',
        'Sellado elástico con masilla de poliuretano',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') ? v : `con ${v}`)
    },
    {
      id: 'metodo_aplicacion',
      field: 'ubicacion',
      text: 'Defina el Método de Aplicación\n¿Cómo se aplicará el producto?',
      chips: () => [
        'Con equipo aspersor / compresor de aire',
        'Con brocha y rodillo de pelo corto',
        'Por inyección a presión en fisuras',
        'Con pistola de calafateo manual',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el tratamiento?',
      chips: () => ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'pza (Pieza)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ]
};

// Aliases para mapear nombres de chips con sus pipelines correspondientes
ACTION_FLOW_PIPELINES['mantenimiento'] = ACTION_FLOW_PIPELINES['reparacion'];
ACTION_FLOW_PIPELINES['suministro e instalacion'] = ACTION_FLOW_PIPELINES['instalacion'];
ACTION_FLOW_PIPELINES['suministro e instalación'] = ACTION_FLOW_PIPELINES['instalacion'];
ACTION_FLOW_PIPELINES['vaciado de concreto'] = ACTION_FLOW_PIPELINES['vaciado'];

/**
 * Pipeline por defecto para cualquier acción no tabulada
 */
export const DEFAULT_PIPELINE = [
  {
    id: 'elemento',
    field: 'elemento',
    text: 'Defina el Elemento o Estructura\n¿Qué elemento o estructura se intervendrá?',
    chips: () => [
      'Paredes de bloques',
      'Columnas y vigas',
      'Losas de concreto',
      'Pavimento / piso',
      'Tuberías y conductos',
      'Estructuras metálicas',
      'Omitir'
    ],
    format: (v) => `de ${v.toLowerCase()}`
  },
  {
    id: 'material',
    field: 'material',
    text: 'Defina el Material o Especificación Técnica\n¿Qué material o especificación técnica se utilizará?',
    chips: () => [
      "Concreto f'c=250 kg/cm²",
      'Mortero cemento-arena 1:3',
      'Acero de refuerzo grado 60',
      'Perfiles de hierro',
      'Omitir'
    ],
    format: (v) => (v.startsWith('con ') || v.startsWith('en ') ? v.toLowerCase() : `con ${v.toLowerCase()}`)
  },
  {
    id: 'ubicacion_alcance',
    field: 'ubicacion',
    text: 'Defina la Ubicación y Alcance\n¿En qué ubicación y bajo qué condiciones se ejecutará?',
    chips: () => ['En planta baja', 'En pisos superiores', 'En exteriores', 'Todo incluido', 'Solo mano de obra', 'Omitir'],
    format: (v) => v
  },
  {
    id: 'unidad',
    field: 'unidad',
    isUnit: true,
    text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la partida?',
    chips: () => ['und (Unidad)', 'pza (Pieza)', 'm² (Metro cuadrado)', 'ml (Metro lineal)', 'm³ (Metro cúbico)', 'Gl (Suma global)'],
    format: (v) => `unidad ${extractCleanUnit(v)}`
  }
];

/**
 * Obtiene el pipeline adaptativo para una acción específica
 * @param {string} accion
 * @returns {Array<object>}
 */
export function getActionPipeline(accion) {
  if (!accion || typeof accion !== 'string') return DEFAULT_PIPELINE;
  const clean = accion.trim().toLowerCase();

  // Buscar coincidencia directa
  if (ACTION_FLOW_PIPELINES[clean]) {
    return ACTION_FLOW_PIPELINES[clean];
  }

  // Buscar por regex
  if (/compactac/i.test(clean)) return ACTION_FLOW_PIPELINES['compactacion'];
  if (/excavac/i.test(clean)) return ACTION_FLOW_PIPELINES['excavacion'];
  if (/demolic/i.test(clean)) return ACTION_FLOW_PIPELINES['demolicion'];
  if (/remoci[oó]n/i.test(clean)) return ACTION_FLOW_PIPELINES['remocion'];
  if (/limpieza/i.test(clean)) return ACTION_FLOW_PIPELINES['limpieza'];
  if (/transporte/i.test(clean)) return ACTION_FLOW_PIPELINES['transporte'];
  if (/acarreo/i.test(clean)) return ACTION_FLOW_PIPELINES['acarreo'];
  if (/deforest/i.test(clean)) return ACTION_FLOW_PIPELINES['deforestacion'];
  if (/rellen/i.test(clean)) return ACTION_FLOW_PIPELINES['relleno'];
  if (/vaciado|concreto/i.test(clean)) return ACTION_FLOW_PIPELINES['vaciado'];
  if (/suministr|instalac/i.test(clean)) return ACTION_FLOW_PIPELINES['instalacion'];
  if (/pintur/i.test(clean)) return ACTION_FLOW_PIPELINES['pintura'];
  if (/impermeabiliz/i.test(clean)) return ACTION_FLOW_PIPELINES['impermeabilizacion'];
  if (/coloca/i.test(clean)) return ACTION_FLOW_PIPELINES['colocacion'];
  if (/desmont/i.test(clean)) return ACTION_FLOW_PIPELINES['desmontaje'];
  if (/reparac|manten/i.test(clean)) return ACTION_FLOW_PIPELINES['reparacion'];
  if (/restaur/i.test(clean)) return ACTION_FLOW_PIPELINES['restauracion'];
  if (/saneam/i.test(clean)) return ACTION_FLOW_PIPELINES['saneamiento'];
  if (/confecc/i.test(clean)) return ACTION_FLOW_PIPELINES['confeccion'];
  if (/tratam/i.test(clean)) return ACTION_FLOW_PIPELINES['tratamiento'];
  if (/construc/i.test(clean)) return ACTION_FLOW_PIPELINES['construccion'];

  return DEFAULT_PIPELINE;
}

/**
 * Ensambla el prompt técnico y extrae la unidad a partir de las respuestas recolectadas
 * @param {string} accion
 * @param {object} answers - Mapa { [stepId]: answerText }
 * @param {Array<object>} pipeline
 * @returns {{ finalPrompt: string, unit: string|null, isGlobal: boolean }}
 */
export function buildPipelinePrompt(accion, answers = {}, pipeline = []) {
  const parts = [];
  if (accion && !isOmitted(accion)) {
    parts.push(accion);
  }

  let extractedUnit = null;
  let isGlobal = false;

  for (const step of pipeline) {
    const rawVal = answers[step.id];
    if (!rawVal || isOmitted(rawVal)) continue;

    if (step.isUnit) {
      const cleanLower = rawVal.toLowerCase().trim();
      isGlobal = ['gl', 'sg', 'global', 'suma global'].includes(cleanLower) || rawVal.trim() === 'Gl' || rawVal.includes('Gl (');
      if (isGlobal) {
        extractedUnit = 'Gl';
        parts.push('unidad Gl');
      } else {
        const u = extractCleanUnit(rawVal);
        if (u) {
          extractedUnit = u;
          parts.push(`unidad ${u}`);
        }
      }
      continue;
    }

    if (typeof step.format === 'function') {
      const formatted = step.format(rawVal, answers);
      if (formatted && formatted.trim()) {
        parts.push(formatted.trim());
      }
    } else {
      parts.push(rawVal.trim());
    }
  }

  const finalPrompt = parts.join(' ').replace(/\s+/g, ' ').trim();
  return { finalPrompt, unit: extractedUnit, isGlobal };
}
