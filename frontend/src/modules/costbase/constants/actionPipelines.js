/**
 * actionPipelines.js
 * Definición de Rutas Dinámicas y Adaptativas para los 23 chips de acción constructiva.
 * Cada acción define su propio orden natural de preguntas, chips contextuales y formateo técnico.
 * 
 * Reglas de Oro de los Chips:
 * 1. Chips 100% atómicos: un solo concepto por chip (sin "A / B" ni "A y B" mezclados).
 * 2. Árbol de decisión contextual: cada paso evalúa answers y ofrece solo opciones técnicamente compatibles.
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
 * Catálogo de pipelines adaptativos por acción con árbol de decisión completo
 */
export const ACTION_FLOW_PIPELINES = {
  // 1. COMPACTACIÓN (Método primero)
  compactacion: [
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método o Equipo de Compactación\n¿Con qué equipo o procedimiento se compactará?',
      chips: () => [
        'Manual con pisón',
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
      chips: (answers = {}) => {
        const metodo = (answers.metodo || '').toLowerCase();
        if (metodo.includes('pisón') || metodo.includes('vibrocompactador') || metodo.includes('rana') || metodo.includes('canguro')) {
          return [
            'Fondo de zanja para tuberías',
            'Fondo de zanja para fundaciones',
            'Relleno alrededor de zapatas',
            'Relleno de zanjas',
            'Subbase de piso',
            'Omitir'
          ];
        }
        if (metodo.includes('rodillo')) {
          return [
            'Subbase de pavimento',
            'Base granular',
            'Terraplenes',
            'Patios de maniobras',
            'Vialidad',
            'Omitir'
          ];
        }
        return [
          'Fondo de zanja para tuberías',
          'Relleno de fundaciones',
          'Subbase de piso',
          'Base granular',
          'Terraplenes',
          'Omitir'
        ];
      },
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'control',
      field: 'incluye',
      text: 'Defina el Espesor de Capa y Control de Calidad\n¿Qué espesor de capa y grado de compactación contempla?',
      chips: (answers = {}) => {
        const metodo = (answers.metodo || '').toLowerCase();
        if (metodo.includes('pisón')) {
          return [
            'En capas de 15 cm compactadas',
            'En capas de 20 cm compactadas',
            'Al 95% del Proctor Modificado',
            'Omitir'
          ];
        }
        return [
          'En capas de 15 cm al 95% Proctor Modificado',
          'En capas de 20 cm al 95% Proctor Modificado',
          'En capas de 30 cm al 95% Proctor Modificado',
          'En capas compactadas de 20 cm',
          'Al 95% del Proctor Modificado',
          'Omitir'
        ];
      },
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
        'Manual con pico y pala',
        'A máquina con retroexcavadora',
        'A máquina con minishovel',
        'Con compresor y martillo neumático',
        'Con tractor de orugas',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Manual') || v.startsWith('A máquina') || v.startsWith('Con ') ? v.toLowerCase() : `excavado con ${v.toLowerCase()}`)
    },
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Zanja a Excavarse\n¿Para qué elemento o estructura es la excavación?',
      chips: (answers = {}) => {
        const metodo = (answers.metodo || '').toLowerCase();
        if (metodo.includes('manual') || metodo.includes('pico')) {
          return [
            'Zanjas para tuberías',
            'Zapatas aisladas',
            'Vigas de riostra',
            'Huecos para postes',
            'Fosas sépticas',
            'Omitir'
          ];
        }
        if (metodo.includes('compresor') || metodo.includes('neumático')) {
          return [
            'Zanja en roca',
            'Zapatas en roca',
            'Perfilado de terreno rocoso',
            'Omitir'
          ];
        }
        return [
          'Cortes masivos de terreno',
          'Zanjas para colectores',
          'Sótanos',
          'Fosas de ascensor',
          'Zapatas',
          'Fundaciones masivas',
          'Lagunas de retención',
          'Omitir'
        ];
      },
      format: (v) => `para ${v.toLowerCase()}`
    },
    {
      id: 'profundidad',
      field: 'ubicacion',
      text: 'Defina el Rango de Profundidad\n¿A qué profundidad se excavará?',
      chips: (answers = {}) => {
        const metodo = (answers.metodo || '').toLowerCase();
        if (metodo.includes('manual')) {
          return [
            'Hasta 1.00 m de profundidad',
            'De 1.00 m a 2.00 m de profundidad',
            'De 2.00 m a 3.00 m de profundidad',
            'Omitir'
          ];
        }
        return [
          'Hasta 2.00 m de profundidad',
          'De 2.00 m a 4.00 m de profundidad',
          'Mayor a 4.00 m de profundidad',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'alcance_bote',
      field: 'incluye',
      text: 'Defina el Alcance de Retiro o Bote\n¿Qué operaciones de desalojo contempla la partida?',
      chips: () => [
        'Incluye carga mecánica en camión',
        'Incluye acarreo interno hasta 50 m',
        'Con bote a botadero en camión volteo',
        'Solo excavación y apilado al borde',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la excavación?',
      chips: () => ['m³ (Metro cúbico)', 'ml (Metro lineal)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 3. DEMOLICIÓN (Método primero)
  demolicion: [
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método de Demolición\n¿Con qué equipo o procedimiento se demolerá?',
      chips: () => [
        'Manual con mandarria y cincel',
        'Con martillo demoledor eléctrico',
        'Con compresor y martillo neumático',
        'Con retroexcavadora y martillo hidráulico',
        'Con cortadora de disco para concreto',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Manual') || v.startsWith('Con ') ? v.toLowerCase() : `demolido con ${v.toLowerCase()}`)
    },
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento a Demoler\n¿Qué elemento o estructura se va a demoler?',
      chips: (answers = {}) => {
        const metodo = (answers.metodo || '').toLowerCase();
        if (metodo.includes('manual') || metodo.includes('eléctrico')) {
          return [
            'Paredes de bloques de arcilla',
            'Paredes de bloques de concreto',
            'Paredes de ladrillo macizo',
            'Frisos de pared',
            'Sobrepisos de mortero',
            'Cielos rasos de yeso',
            'Omitir'
          ];
        }
        return [
          'Losas de concreto armado',
          'Pisos de concreto',
          'Pavimentos de concreto',
          'Pavimentos de asfalto',
          'Columnas',
          'Vigas',
          'Brocales',
          'Bordillos',
          'Fundaciones de concreto',
          'Omitir'
        ];
      },
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'espesor',
      field: 'ubicacion',
      text: 'Defina el Espesor del Elemento\n¿Qué espesor o calibre tiene la estructura a demoler?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('pared')) {
          return ['Espesor e=10 cm', 'Espesor e=15 cm', 'Espesor e=20 cm', 'Espesor e=25 cm', 'Omitir'];
        }
        if (elem.includes('piso') || elem.includes('pavimento') || elem.includes('losa')) {
          return ['Espesor e=5 cm', 'Espesor e=10 cm', 'Espesor e=15 cm', 'Espesor e=20 cm', 'Omitir'];
        }
        return ['Espesor e=10 cm', 'Espesor e=15 cm', 'Espesor e=20 cm', 'Espesor mayor a 25 cm', 'Omitir'];
      },
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de Desalojo de Escombros\n¿Qué retiro de escombros incluye la partida?',
      chips: () => [
        'Incluye acarreo interno y apilado',
        'Incluye carga y bote en camión a botadero',
        'Solo demolición',
        'Omitir'
      ],
      format: (v) => v
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
      text: 'Defina el Método de Remoción\n¿Cómo se removerá el material o elemento?',
      chips: () => [
        'Manual con herramientas menores',
        'Mecánica con retroexcavadora',
        'Con escarificadora mecánica',
        'Con soplete de oxicorte',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Manual') || v.startsWith('Mecánica') || v.startsWith('Con ') ? v.toLowerCase() : `removido con ${v.toLowerCase()}`)
    },
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Capa a Remover\n¿Qué elemento existente se va a remover?',
      chips: (answers = {}) => {
        const metodo = (answers.metodo || '').toLowerCase();
        if (metodo.includes('retroexcavadora') || metodo.includes('mecánica')) {
          return [
            'Capa vegetal de terreno (descapote)',
            'Base granular contaminada',
            'Pavimento asfáltico deteriorado',
            'Tuberías enterradas existentes',
            'Omitir'
          ];
        }
        if (metodo.includes('oxicorte')) {
          return [
            'Estructuras metálicas de acero',
            'Perfiles de hierro',
            'Tuberías de acero',
            'Omitir'
          ];
        }
        return [
          'Cerámica de piso',
          'Porcelanato de piso',
          'Azulejos de pared',
          'Manto asfáltico en techos',
          'Puertas de madera',
          'Puertas metálicas',
          'Ventanas de aluminio',
          'Rejas metálicas',
          'Tuberías de agua',
          'Tuberías sanitarias',
          'Inodoros',
          'Lavamanos',
          'Omitir'
        ];
      },
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'condicion',
      field: 'ubicacion',
      text: 'Defina la Condición de Recuperación\n¿Se requiere recuperar y preservar el material o es para desecho?',
      chips: () => [
        'Con recuperación de piezas para reutilización',
        'Sin recuperación de material (desecho)',
        'Con cuidado para no dañar sustrato base',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de Desalojo\n¿Qué desalojo incluye la partida?',
      chips: () => [
        'Incluye limpieza de área y apilado',
        'Incluye carga y bote en camión a botadero',
        'Solo remoción',
        'Omitir'
      ],
      format: (v) => v
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

  // 5. LIMPIEZA
  limpieza: [
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Procedimiento o Equipo de Limpieza\n¿Cómo se ejecutará la limpieza?',
      chips: () => [
        'Manual',
        'Con hidrolavadora a presión',
        'Con minishovel',
        'Con barredora mecánica',
        'Con compresor de aire industrial',
        'Omitir'
      ],
      format: (v) => (v.startsWith('Manual') || v.startsWith('Con ') ? v.toLowerCase() : `limpiado con ${v.toLowerCase()}`)
    },
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Área o Elemento a Limpiar\n¿Qué zona, terreno o superficie se limpiará?',
      chips: (answers = {}) => {
        const metodo = (answers.metodo || '').toLowerCase();
        if (metodo.includes('minishovel') || metodo.includes('mecánica') || metodo.includes('barredora')) {
          return [
            'Terreno con maleza liviana',
            'Terreno con escombros',
            'Terreno con desechos sólidos',
            'Patios de maniobras',
            'Galpones industriales',
            'Omitir'
          ];
        }
        if (metodo.includes('hidrolavadora')) {
          return [
            'Fachadas exteriores',
            'Pisos de concreto',
            'Pisos de porcelanato',
            'Tanques de agua',
            'Techos',
            'Omitir'
          ];
        }
        if (metodo.includes('compresor')) {
          return [
            'Estructuras metálicas',
            'Juntas de dilatación en pavimentos',
            'Ductos de ventilación',
            'Omitir'
          ];
        }
        return [
          'Pisos de concreto posconstrucción',
          'Pisos de porcelanato posconstrucción',
          'Terreno con maleza liviana',
          'Terreno con escombros',
          'Canaletas de lluvia',
          'Ventanas',
          'Omitir'
        ];
      },
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de la Limpieza\n¿Qué operaciones de tratamiento contempla?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('terreno') || elem.includes('patio') || elem.includes('galpón')) {
          return [
            'Incluye recolección en sacos y bote',
            'Incluye desmalezado y apilado en sitio',
            'Solo barrido y despeje superficial',
            'Omitir'
          ];
        }
        if (elem.includes('piso')) {
          return [
            'Incluye desengrase químico profundo',
            'Incluye decapado de manchas y lavado neutro',
            'Solo barrido y mopeado superficial',
            'Omitir'
          ];
        }
        if (elem.includes('tanque')) {
          return [
            'Incluye desinfección con hipoclorito de sodio',
            'Incluye achique de fondo y lavado a presión',
            'Omitir'
          ];
        }
        if (elem.includes('fachada') || elem.includes('techo')) {
          return [
            'Incluye retiro de moho con fungicida',
            'Solo lavado con agua a presión',
            'Omitir'
          ];
        }
        if (elem.includes('ventana')) {
          return [
            'Incluye desmanchado de marcos y limpieza de vidrios',
            'Solo lavado de vidrios',
            'Omitir'
          ];
        }
        return [
          'Incluye recolección en sacos y bote',
          'Solo barrido y limpieza superficial',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la limpieza?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('tanque')) {
          return ['und (Por tanque)', 'm³ (Metro cúbico)', 'Gl (Suma global)'];
        }
        if (elem.includes('canaleta') || elem.includes('junta')) {
          return ['ml (Metro lineal)', 'Gl (Suma global)'];
        }
        return ['m² (Metro cuadrado)', 'Gl (Suma global)', 'und (Por unidad)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 6. TRANSPORTE (Logística pesada)
  transporte: [
    {
      id: 'material_carga',
      field: 'elemento',
      text: 'Defina el Material o Carga a Transportar\n¿Qué tipo de material o carga se va a transportar?',
      chips: () => [
        'Escombros de demolición',
        'Tierra de excavación',
        'Arena lavada',
        'Piedra picada',
        'Asfalto en caliente',
        'Bloques de arcilla',
        'Bloques de concreto',
        'Cemento en sacos',
        'Cabillas de acero',
        'Maquinaria pesada',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'vehiculo',
      field: 'material',
      text: 'Defina el Tipo de Vehículo de Transporte\n¿En qué tipo de vehículo de carga se transportará?',
      chips: (answers = {}) => {
        const mat = (answers.material_carga || '').toLowerCase();
        if (mat.includes('maquinaria')) {
          return [
            'En chuto con lowboy',
            'En camión plataforma con winche',
            'Omitir'
          ];
        }
        if (mat.includes('bloque') || mat.includes('cemento') || mat.includes('cabilla')) {
          return [
            'En camión plataforma 350',
            'En camión plataforma 750 (toronja)',
            'En gandola de 30 toneladas',
            'Omitir'
          ];
        }
        return [
          'En camión volteo de 7 m³',
          'En camión volteo de 14 m³',
          'En camión volteo de 20 m³ (chuto)',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'distancia',
      field: 'ubicacion',
      text: 'Defina la Distancia de Transporte\n¿Cuál es la distancia aproximada de acarreo / transporte?',
      chips: () => [
        'Hasta 5 km de distancia',
        'De 5 a 15 km de distancia',
        'De 15 a 30 km de distancia',
        'De 30 a 50 km de distancia',
        'Mayor a 50 km de distancia',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de Carga y Descarga\n¿Qué operaciones complementarias incluye el transporte?',
      chips: () => [
        'Incluye carga mecánica y descarga en botadero',
        'Incluye carga manual y descarga',
        'Solo flete y transporte (sin carga ni descarga)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el transporte?',
      chips: () => ['m³-km (Metro cúbico por kilómetro)', 'viaje (Por viaje)', 'm³ (Metro cúbico)', 'ton-km (Tonelada-kilómetro)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 7. ACARREO (Logística menor en obra)
  acarreo: [
    {
      id: 'material',
      field: 'elemento',
      text: 'Defina el Material a Trasladar\n¿Qué insumo o escombro se va a acarrear?',
      chips: () => [
        'Escombros de demolición',
        'Tierra de excavación',
        'Bloques de arcilla',
        'Bloques de concreto',
        'Cemento en sacos',
        'Arena lavada',
        'Piedra picada',
        'Cabillas de acero',
        'Cerámicas',
        'Porcelanatos',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'medio',
      field: 'material',
      text: 'Defina el Medio de Acarreo\n¿Cómo se trasladará internamente el material?',
      chips: (answers = {}) => {
        const mat = (answers.material || '').toLowerCase();
        if (mat.includes('cabilla')) {
          return [
            'A hombro por cuadrilla',
            'Manual por cuadrilla de obreros',
            'Omitir'
          ];
        }
        if (mat.includes('escombro') || mat.includes('tierra') || mat.includes('arena') || mat.includes('piedra')) {
          return [
            'Manual en carretilla',
            'Manual en tobos',
            'Con minishovel mecánico',
            'Con motocarretilla (buggy)',
            'Omitir'
          ];
        }
        return [
          'Manual en carretilla',
          'A hombro por cuadrilla',
          'Con carretilla de dos ruedas',
          'Omitir'
        ];
      },
      format: (v) => v.toLowerCase()
    },
    {
      id: 'distancia_nivel',
      field: 'ubicacion',
      text: 'Defina la Distancia o Cambio de Nivel\n¿A qué distancia o piso se realizará el acarreo?',
      chips: () => [
        'En planta baja hasta 50 m de distancia',
        'En planta baja hasta 100 m de distancia',
        'Hacia pisos superiores por escaleras',
        'Hacia pisos superiores con malacate / güinche',
        'Hacia sótanos',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el acarreo?',
      chips: (answers = {}) => {
        const mat = (answers.material || '').toLowerCase();
        if (mat.includes('bloque')) {
          return ['und (Por bloque)', 'viaje (Por viaje de carretilla)', 'Gl (Suma global)'];
        }
        if (mat.includes('cemento') || mat.includes('saco')) {
          return ['saco (Por saco)', 'viaje (Por viaje de carretilla)', 'Gl (Suma global)'];
        }
        if (mat.includes('cabilla')) {
          return ['kgf (Kilogramo fuerza)', 'ton (Tonelada)', 'Gl (Suma global)'];
        }
        return ['m³ (Metro cúbico)', 'viaje (Por viaje de carretilla)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 8. DEFORESTACIÓN (Sitio / Tierra)
  deforestacion: [
    {
      id: 'tipo_vegetacion',
      field: 'elemento',
      text: 'Defina la Vegetación o Zona a Intervenir\n¿Qué tipo de vegetación se va a deforestar?',
      chips: () => [
        'Maleza liviana (hasta 1 m de altura)',
        'Rastrojo',
        'Matorral denso',
        'Arbustos medianos',
        'Árboles delgados con diámetro menor a 20 cm',
        'Árboles medianos con diámetro de 20 a 40 cm',
        'Árboles grandes con diámetro mayor a 40 cm',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método de Deforestación\n¿Con qué equipo se realizará la tala o desmonte?',
      chips: (answers = {}) => {
        const veg = (answers.tipo_vegetacion || '').toLowerCase();
        if (veg.includes('árbol')) {
          return [
            'Con motosierra',
            'Tala y destoconado mecánico con retroexcavadora',
            'Tala con motosierra y destoconado manual',
            'Omitir'
          ];
        }
        return [
          'Manual con machete',
          'Con desbrozadora a motor (guadaña)',
          'Mecánica con tractor de orugas (Bulldozer D6)',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('Con ') || v.startsWith('Manual') || v.startsWith('Mecánica') || v.startsWith('Tala') ? v.toLowerCase() : `mediante ${v.toLowerCase()}`)
    },
    {
      id: 'disposicion',
      field: 'ubicacion',
      text: 'Defina la Disposición de Material Vegetal\n¿Qué se hará con los troncos, ramas y restos vegetales?',
      chips: () => [
        'Incluye repicado, apilado y quema controlada',
        'Incluye carga mecánica y bote fuera de la obra',
        'Incluye destoconado y extracción de raíces',
        'Solo corte y volteo en sitio',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la deforestación?',
      chips: (answers = {}) => {
        const veg = (answers.tipo_vegetacion || '').toLowerCase();
        if (veg.includes('árbol')) {
          return ['und (Por árbol talado)', 'ha (Hectárea)', 'm² (Metro cuadrado)', 'Gl (Suma global)'];
        }
        return ['m² (Metro cuadrado)', 'ha (Hectárea)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 9. RELLENO
  relleno: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina la Zona o Elemento a Rellenar\n¿Qué área se va a rellenar?',
      chips: () => [
        'Zanjas para tuberías',
        'Zanjas para fundaciones',
        'Alrededor de zapatas',
        'Bajo piso de concreto',
        'Terraplén vial',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'material',
      field: 'material',
      text: 'Defina el Material de Relleno\n¿Con qué tipo de material se rellenará?',
      chips: () => [
        'Con tierra seleccionada de la excavación (material propio)',
        'Con material de préstamo granular (granzón)',
        'Con arena lavada',
        'Con piedra picada',
        'Con ripio',
        'Con piedra bola',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') || v.startsWith('Con ') ? v : `con ${v}`)
    },
    {
      id: 'metodo_compactacion',
      field: 'ubicacion',
      text: 'Defina el Método de Compactación\n¿Cómo se compactará el relleno?',
      chips: () => [
        'Compactado manual con pisón',
        'Compactado con vibrocompactador (rana / canguro)',
        'Compactado con rodillo vibratorio manual',
        'Compactado con rodillo autopropulsado pesado',
        'Relleno simple sin compactar',
        'Omitir'
      ],
      format: (v) => v.toLowerCase()
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Espesor de Capas y Alcance\n¿Qué condiciones de suministro y compactación incluye?',
      chips: () => [
        'En capas de 20 cm compactadas al 95% Proctor',
        'En capas de 30 cm compactadas al 95% Proctor',
        'Todo incluido (suministro de material + transporte + compactación)',
        'Solo colocación y compactación (material en sitio)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el relleno?',
      chips: () => ['m³ (Metro cúbico)', 'ml (Metro lineal de zanja)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 10. CONSTRUCCIÓN (Elemento primero - 100% atómico)
  construccion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Estructura a Construir\n¿Qué elemento o estructura se va a construir?',
      chips: () => [
        'Paredes de bloques de arcilla',
        'Paredes de bloques de concreto',
        'Paredes de ladrillo macizo',
        'Columnas',
        'Vigas',
        'Zapatas aisladas',
        'Vigas de riostra',
        'Losas de entrepiso',
        'Losas de techo',
        'Pisos de concreto',
        'Pavimentos de concreto',
        'Brocales',
        'Bordillos',
        'Aceras de concreto',
        'Estructuras metálicas de acero',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'material',
      field: 'material',
      text: 'Defina el Material o Especificación Constructiva\n¿Con qué material o dosificación se construirá?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('arcilla')) {
          return [
            'Bloque de arcilla e=10 cm con mortero 1:4',
            'Bloque de arcilla e=15 cm con mortero 1:4',
            'Bloque de arcilla e=20 cm con mortero 1:4',
            'Omitir'
          ];
        }
        if (elem.includes('bloques de concreto')) {
          return [
            'Bloque de concreto e=15 cm con mortero 1:4',
            'Bloque de concreto e=20 cm con mortero 1:4',
            'Bloque de concreto e=10 cm con mortero 1:4',
            'Omitir'
          ];
        }
        if (elem.includes('columna') || elem.includes('viga') || elem.includes('zapata') || elem.includes('riostra') || elem.includes('losa')) {
          return [
            'Concreto f\'c=250 kg/cm² con acero fy=4200 y encofrado',
            'Concreto f\'c=280 kg/cm² con acero fy=4200 y encofrado',
            'Concreto f\'c=210 kg/cm² con acero fy=4200 y encofrado',
            'Solo concreto premezclado f\'c=250 kg/cm² (sin acero)',
            'Omitir'
          ];
        }
        if (elem.includes('piso') || elem.includes('pavimento')) {
          return [
            'Concreto f\'c=210 kg/cm² e=10 cm con malla electrosoldada',
            'Concreto f\'c=250 kg/cm² e=15 cm con junta y pasadores',
            'Concreto f\'c=280 kg/cm² e=20 cm de alto tráfico',
            'Omitir'
          ];
        }
        if (elem.includes('brocal') || elem.includes('bordillo') || elem.includes('acera')) {
          return [
            'Concreto f\'c=210 kg/cm² con encofrado metálico',
            'Concreto f\'c=250 kg/cm² con junta de dilatación',
            'Omitir'
          ];
        }
        if (elem.includes('metálica') || elem.includes('acero')) {
          return [
            'Perfiles tubulares estructurales con soldadura 7018',
            'Vigas IPE y columnas HEB con pintura anticorrosiva',
            'Perfiles de hierro en ángulo y pletinas',
            'Omitir'
          ];
        }
        return [
          'Concreto f\'c=250 kg/cm²',
          'Mortero cemento-arena 1:3',
          'Acero de refuerzo grado 60',
          'Perfiles de acero estructural',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('con ') || v.startsWith('Con ') ? v : `con ${v}`)
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
        'Todo incluido (Materiales + Mano de Obra + Equipos)',
        'Incluye andamios y transporte interno',
        'Solo mano de obra y equipos (materiales suministrados)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la partida?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('columna') || elem.includes('viga') || elem.includes('zapata') || elem.includes('riostra')) {
          return ['m³ (Metro cúbico)', 'ml (Metro lineal)', 'pza (Pieza)', 'Gl (Suma global)'];
        }
        if (elem.includes('brocal') || elem.includes('bordillo')) {
          return ['ml (Metro lineal)', 'm³ (Metro cúbico)', 'Gl (Suma global)'];
        }
        if (elem.includes('metálica') || elem.includes('acero')) {
          return ['kgf (Kilogramo fuerza)', 'ton (Tonelada)', 'm² (Metro cuadrado)', 'Gl (Suma global)'];
        }
        return ['m² (Metro cuadrado)', 'm³ (Metro cúbico)', 'ml (Metro lineal)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 11. VACIADO DE CONCRETO (Elemento primero)
  vaciado: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento Estructural\n¿En qué elemento se vaciará el concreto?',
      chips: () => [
        'Columnas',
        'Vigas',
        'Zapatas aisladas',
        'Vigas de riostra',
        'Losas de entrepiso',
        'Losas de techo',
        'Pisos de concreto',
        'Pavimentos de concreto',
        'Muros de contención',
        'Brocales',
        'Bordillos',
        'Aceras de concreto',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'especificacion',
      field: 'material',
      text: 'Defina la Resistencia del Concreto\n¿Qué resistencia y tipo de concreto se vaciará?',
      chips: () => [
        'Concreto premezclado f\'c=210 kg/cm²',
        'Concreto premezclado f\'c=250 kg/cm²',
        'Concreto premezclado f\'c=280 kg/cm²',
        'Concreto premezclado f\'c=300 kg/cm²',
        'Concreto f\'c=210 kg/cm² mezclado en obra',
        'Concreto pobre f\'c=150 kg/cm² (limpieza)',
        'Omitir'
      ],
      format: (v) => (v.startsWith('con ') || v.startsWith('Con ') ? v : `con ${v}`)
    },
    {
      id: 'metodo_vaciado',
      field: 'ubicacion',
      text: 'Defina el Método de Colocación\n¿Cómo se transportará y vaciará el concreto en el elemento?',
      chips: () => [
        'Con bomba de concreto pluma',
        'Con bomba de concreto estacionaria',
        'Directo desde camión mixer por canaleta',
        'Con grúa y capacho',
        'Manual con trompo, carretillas y tobos',
        'Omitir'
      ],
      format: (v) => v.toLowerCase()
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de Acabado y Curado\n¿Qué cuidados posteriores incluye el vaciado?',
      chips: () => [
        'Incluye vibrado mecánico y curado con agua',
        'Incluye aditivo fluidificante plastificante',
        'Incluye aditivo acelerante de fraguado',
        'Solo colocación y vibrado (sin curado)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el vaciado?',
      chips: () => ['m³ (Metro cúbico)', 'm² (Metro cuadrado)', 'ml (Metro lineal)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 12. INSTALACIÓN / SUMINISTRO E INSTALACIÓN (Elemento -> Capacidad/Diámetro)
  instalacion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Equipo a Instalar\n¿Qué insumo, equipo o pieza constructiva se va a instalar?',
      chips: () => [
        'Tubería de agua potable termofusión (PPR)',
        'Tubería de agua potable PVC',
        'Tubería de aguas servidas PVC',
        'Tubería de gas en cobre',
        'Tableros eléctricos',
        'Breakers termomagnéticos',
        'Protecciones eléctricas',
        'Transformadores eléctricos',
        'Bombas de agua',
        'Inodoros',
        'Lavamanos',
        'Griferías',
        'Llaves de paso',
        'Luminarias LED',
        'Aires acondicionados split',
        'Puertas de madera',
        'Puertas metálicas',
        'Ventanas de aluminio',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'capacidad',
      field: 'material',
      text: 'Defina la Capacidad, Diámetro o Calibre\n¿Qué especificación técnica o dimensión tiene el elemento?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('tubería')) {
          return [
            'Diámetro 1/2"',
            'Diámetro 3/4"',
            'Diámetro 1"',
            'Diámetro 2"',
            'Diámetro 3"',
            'Diámetro 4"',
            'Omitir'
          ];
        }
        if (elem.includes('bomba')) {
          return [
            'Potencia 0.5 HP',
            'Potencia 1 HP',
            'Potencia 2 HP',
            'Potencia 5 HP',
            'Omitir'
          ];
        }
        if (elem.includes('transformador')) {
          return [
            'Capacidad 25 kVA',
            'Capacidad 50 kVA',
            'Capacidad 75 kVA',
            'Capacidad 100 kVA',
            'Omitir'
          ];
        }
        if (elem.includes('aire')) {
          return [
            'Capacidad 12.000 BTU',
            'Capacidad 18.000 BTU',
            'Capacidad 24.000 BTU',
            'Omitir'
          ];
        }
        if (elem.includes('breaker') || elem.includes('protección')) {
          return [
            'Breaker termomagnético 1x20A',
            'Breaker termomagnético 2x20A',
            'Breaker termomagnético 3x50A',
            'Protección contra sobretensiones (DPS)',
            'Omitir'
          ];
        }
        if (elem.includes('tablero')) {
          return [
            'Tablero de 12 circuitos',
            'Tablero de 24 circuitos',
            'Tablero de 42 circuitos',
            'Omitir'
          ];
        }
        if (elem.includes('grifería') || elem.includes('llave')) {
          return [
            'Diámetro 1/2"',
            'Diámetro 3/4"',
            'Diámetro 1"',
            'Cromada de lavamanos monomando',
            'Omitir'
          ];
        }
        if (elem.includes('inodoro') || elem.includes('lavamanos')) {
          return [
            'Con grifería y accesorios completos',
            'Línea comercial estándar blanco',
            'Línea institucional antivandálica',
            'Omitir'
          ];
        }
        if (elem.includes('puerta') || elem.includes('ventana')) {
          return [
            'Medida estándar 0.70 x 2.10 m con cerradura',
            'Medida estándar 0.80 x 2.10 m con cerradura',
            'Medida estándar 0.90 x 2.10 m con cerradura',
            'Medida 1.20 x 1.00 m con vidrio de 4 mm',
            'Omitir'
          ];
        }
        return [
          'Capacidad estándar de catálogo',
          'Especificación indicada en planos',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'ubicacion',
      field: 'ubicacion',
      text: 'Defina la Ubicación de Montaje\n¿En qué área o nivel se montará?',
      chips: () => [
        'En planta baja',
        'En pisos superiores',
        'En sala de bombas',
        'En tabiquería interior',
        'En exteriores',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de Instalación\n¿Qué operaciones de conexión y pruebas incluye?',
      chips: () => [
        'Todo incluido (Suministro + Montaje + Conexiones)',
        'Solo instalación y mano de obra (equipo suministrado en obra)',
        'Incluye pruebas de presión y certificación',
        'Incluye puesta en marcha y calibración',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la partida?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('tubería')) {
          return ['ml (Metro lineal)', 'und (Unidad)', 'Gl (Suma global)'];
        }
        return ['und (Unidad)', 'pza (Pieza)', 'jgo (Juego)', 'pto (Punto)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 13. PINTURA (Superficie -> Tipo compatible -> Manos -> Altura)
  pintura: [
    {
      id: 'superficie',
      field: 'elemento',
      text: 'Defina la Superficie a Pintar\n¿Qué elemento o superficie se va a recubrir?',
      chips: () => [
        'Paredes interiores',
        'Fachadas exteriores',
        'Cielos rasos',
        'Pisos de concreto interiores',
        'Pavimentos exteriores',
        'Canchas deportivas',
        'Rejas',
        'Puertas metálicas',
        'Estructuras metálicas de acero',
        'Brocales',
        'Bordillos',
        'Demarcación vial',
        'Pasos peatonales',
        'Madera',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'tipo_pintura',
      field: 'material',
      text: 'Defina el Tipo de Pintura o Acabado\n¿Qué recubrimiento compatible se aplicará?',
      chips: (answers = {}) => {
        const sup = (answers.superficie || '').toLowerCase();
        if (sup.includes('pisos de concreto')) {
          return [
            'Pintura epóxica autonivelante de alto tráfico',
            'Pintura epóxica bicomponente (primer + acabado)',
            'Pintura poliuretano alifático resistente a químicos',
            'Sellador acrílico antipolvo transparente para concreto',
            'Omitir'
          ];
        }
        if (sup.includes('pavimentos exteriores')) {
          return [
            'Pintura de tráfico base solvente (clorocaucho)',
            'Pintura de tráfico base agua de secado rápido',
            'Pintura termoplástica reflectiva',
            'Omitir'
          ];
        }
        if (sup.includes('canchas deportivas')) {
          return [
            'Pintura acrílica elastomérica para canchas deportivas con arena sílice',
            'Esmalte poliuretano para pistas y canchas',
            'Omitir'
          ];
        }
        if (sup.includes('paredes interiores') || sup.includes('cielos rasos')) {
          return [
            'Pintura de caucho clase A (lavable)',
            'Pintura de caucho clase B',
            'Pintura de caucho satinada',
            'Pintura antihongos y antimoho (para baños y cocinas)',
            'Omitir'
          ];
        }
        if (sup.includes('fachadas exteriores')) {
          return [
            'Pintura elastomérica impermeable antihongos para exteriores',
            'Pintura de caucho clase A resistente a rayos UV',
            'Revestimiento texturizado acrílico para fachadas',
            'Omitir'
          ];
        }
        if (sup.includes('rejas') || sup.includes('puertas metálicas') || sup.includes('estructuras metálicas')) {
          return [
            'Esmalte sintético brillante sobre fondo anticorrosivo',
            'Esmalte sintético satinado',
            'Fondo anticorrosivo alquídico (solo fondo)',
            'Fondo cromato de zinc',
            'Fondo epóxico anticorrosivo',
            'Omitir'
          ];
        }
        if (sup.includes('brocales') || sup.includes('bordillos')) {
          return [
            'Pintura de tráfico amarillo brocal',
            'Pintura de tráfico negro y amarillo en franjas',
            'Pintura de tráfico reflectiva con microesferas',
            'Omitir'
          ];
        }
        if (sup.includes('demarcación vial') || sup.includes('pasos peatonales')) {
          return [
            'Pintura de tráfico blanco con microesferas reflectivas',
            'Pintura de tráfico amarillo vial reflectivo',
            'Pintura termoplástica reflectiva en caliente',
            'Omitir'
          ];
        }
        if (sup.includes('madera')) {
          return [
            'Barniz marino transparente de alta resistencia',
            'Sellador nitrocelulósico',
            'Laca brillante',
            'Lasur protector microporoso para exteriores',
            'Esmalte sintético para madera',
            'Omitir'
          ];
        }
        return [
          'Pintura de caucho clase A',
          'Pintura esmalte sintético brillante',
          'Pintura epóxica alto tráfico',
          'Pintura de tráfico reflectiva',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('con ') || v.startsWith('Con ') ? v : `con ${v}`)
    },
    {
      id: 'manos_fondo',
      field: 'incluye',
      text: 'Defina el Número de Manos y Preparación\n¿Qué preparación de fondo y capas incluye?',
      chips: (answers = {}) => {
        const sup = (answers.superficie || '').toLowerCase();
        if (sup.includes('rejas') || sup.includes('puertas metálicas') || sup.includes('estructuras metálicas')) {
          return [
            '1 mano de fondo anticorrosivo + 2 manos de esmalte de acabado',
            '2 manos de esmalte sintético directo',
            '1 mano de cromato de zinc + 2 manos de acabado epóxico',
            'Omitir'
          ];
        }
        if (sup.includes('pisos de concreto')) {
          return [
            'Con escarificación mecánica + 1 mano de primer + 2 manos de epóxico',
            '2 manos de recubrimiento epóxico',
            'Omitir'
          ];
        }
        if (sup.includes('brocales') || sup.includes('bordillos') || sup.includes('demarcación vial') || sup.includes('pasos peatonales')) {
          return [
            'A 2 manos con aplicación manual',
            'A 1 mano con máquina pinta-rayas mecanizada',
            'Omitir'
          ];
        }
        return [
          'A 2 manos con empastado y preparación de superficie',
          'A 2 manos sobre friso existente',
          'A 3 manos con lijado intermedio',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'altura',
      field: 'ubicacion',
      text: 'Defina la Altura y Medios de Trabajo\n¿A qué altura se ejecutará el trabajo?',
      chips: (answers = {}) => {
        const sup = (answers.superficie || '').toLowerCase();
        if (sup.includes('fachadas exteriores')) {
          return [
            'Con andamios tubulares en altura (más de 3 m)',
            'A nivel de planta baja hasta 3 m',
            'A rapel con silleta de guíndola',
            'Omitir'
          ];
        }
        if (sup.includes('pisos') || sup.includes('pavimentos') || sup.includes('brocales') || sup.includes('bordillos') || sup.includes('demarcación') || sup.includes('pasos peatonales')) {
          return [
            'A nivel de piso',
            'Omitir'
          ];
        }
        return [
          'A nivel de planta baja hasta 3 m',
          'En doble altura con andamios',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la pintura?',
      chips: (answers = {}) => {
        const sup = (answers.superficie || '').toLowerCase();
        if (sup.includes('brocales') || sup.includes('bordillos') || sup.includes('demarcación vial')) {
          return ['ml (Metro lineal)', 'm² (Metro cuadrado)', 'Gl (Suma global)'];
        }
        if (sup.includes('puertas metálicas')) {
          return ['pza (Pieza)', 'm² (Metro cuadrado)', 'Gl (Suma global)'];
        }
        if (sup.includes('pasos peatonales')) {
          return ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'pza (Por paso peatonal)', 'Gl (Suma global)'];
        }
        return ['m² (Metro cuadrado)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 14. IMPERMEABILIZACIÓN
  impermeabilizacion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Área a Impermeabilizar\n¿En qué elemento o cubierta se aplicará la impermeabilización?',
      chips: () => [
        'Techos de concreto',
        'Losas de entrepiso',
        'Techos de machihembrado de madera',
        'Jardineras',
        'Muros de contención enterrados',
        'Tanques de agua',
        'Fosos de ascensor',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'sistema',
      field: 'material',
      text: 'Defina el Sistema Impermeabilizante\n¿Qué tipo de manto o membrana se instalará?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('machihembrado')) {
          return [
            'Manto asfáltico autoadhesivo aluminizado (sin soplete)',
            'Manto asfáltico de 3 mm con fijación mecánica',
            'Membrana líquida elastomérica reflectiva',
            'Omitir'
          ];
        }
        if (elem.includes('jardinera') || elem.includes('muro') || elem.includes('tanque') || elem.includes('foso')) {
          return [
            'Mortero cementoso impermeable bicomponente',
            'Manto asfáltico de 4 mm antiraíz',
            'Membrana de poliuretano impermeable líquida',
            'Omitir'
          ];
        }
        return [
          'Manto asfáltico de 4 mm con polímeros SBS/APP',
          'Manto asfáltico de 3 mm con polímeros SBS/APP',
          'Membrana líquida de poliuretano elastomérica',
          'Membrana líquida acrílica reflectiva',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('con ') || v.startsWith('Con ') ? v : `con ${v}`)
    },
    {
      id: 'acabado',
      field: 'incluye',
      text: 'Defina el Acabado y Protección Térmica\n¿Qué recubrimiento de acabado y protección incluye?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('tanque') || elem.includes('muro') || elem.includes('jardinera') || elem.includes('foso')) {
          return [
            'Con sobrepiso de mortero hidrófugo de protección',
            'Con sellador epóxico grado alimenticio',
            'Sin acabado adicional',
            'Omitir'
          ];
        }
        return [
          'Con pintura de aluminio reflectiva',
          'Con acabado de tejas asfálticas',
          'Con sobrepiso de mortero de protección',
          'Sin acabado adicional',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la impermeabilización?',
      chips: () => ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 15. COLOCACIÓN
  colocacion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Revestimiento a Colocar\n¿Qué elemento constructivo se va a colocar?',
      chips: () => [
        'Cerámica en pisos',
        'Porcelanato en pisos',
        'Azulejos en paredes de baños',
        'Puertas de madera',
        'Puertas metálicas',
        'Ventanas de aluminio',
        'Techos de láminas de acerolit',
        'Techos de láminas de zinc',
        'Brocales prefabricados',
        'Bordillos prefabricados',
        'Adoquines de concreto',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'material_fijacion',
      field: 'material',
      text: 'Defina el Material de Fijación o Pega\n¿Con qué mortero o anclaje se instalará?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('cerámica') || elem.includes('porcelanato') || elem.includes('azulejo')) {
          return [
            'Con mortero adhesivo gris (pega común)',
            'Con mortero adhesivo blanco de alta adherencia para porcelanato',
            'Con mortero cemento-arena 1:3',
            'Omitir'
          ];
        }
        if (elem.includes('puerta') || elem.includes('ventana')) {
          return [
            'Con tornillos autorroscantes y ramplug',
            'Con espuma de poliuretano expansiva y anclajes',
            'Omitir'
          ];
        }
        if (elem.includes('techo')) {
          return [
            'Con ganchos de fijación y arandelas de neopreno sobre correas metálicas',
            'Con tornillos autorroscantes sobre correas de madera',
            'Omitir'
          ];
        }
        if (elem.includes('adoquín')) {
          return [
            'Sobre cama de arena nivelada e intertrabado con arena fina',
            'Omitir'
          ];
        }
        if (elem.includes('brocal') || elem.includes('bordillo')) {
          return [
            'Sobre base de mortero nivelada',
            'Omitir'
          ];
        }
        return [
          'Con mortero adhesivo especial',
          'Con anclajes mecánicos',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de Acabado y Juntas\n¿Qué operaciones de acabado contempla la partida?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('cerámica') || elem.includes('porcelanato') || elem.includes('azulejo')) {
          return [
            'Incluye emboquillado con pastina antimoho',
            'Incluye nivelación y corte de piezas',
            'Todo incluido (material de fijación + mano de obra)',
            'Solo colocación y mano de obra',
            'Omitir'
          ];
        }
        if (elem.includes('puerta') || elem.includes('ventana')) {
          return [
            'Incluye cerraduras, bisagras y accesorios',
            'Incluye sellado perimetral con silicón',
            'Todo incluido (suministro de fijación + montaje)',
            'Solo mano de obra',
            'Omitir'
          ];
        }
        if (elem.includes('techo')) {
          return [
            'Incluye caballetes y remates de cumbrera',
            'Incluye fijaciones y sellado de solapes',
            'Todo incluido (fijaciones + montaje)',
            'Solo mano de obra',
            'Omitir'
          ];
        }
        if (elem.includes('adoquín') || elem.includes('brocal') || elem.includes('bordillo')) {
          return [
            'Incluye alineación, nivelación y emboquillado de juntas',
            'Todo incluido (material de asiento + mano de obra)',
            'Solo colocación y mano de obra',
            'Omitir'
          ];
        }
        return [
          'Todo incluido (materiales + mano de obra)',
          'Solo colocación y mano de obra',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la colocación?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('puerta') || elem.includes('ventana')) {
          return ['pza (Pieza)', 'und (Unidad)', 'Gl (Suma global)'];
        }
        if (elem.includes('brocal') || elem.includes('bordillo')) {
          return ['ml (Metro lineal)', 'pza (Pieza)', 'Gl (Suma global)'];
        }
        return ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 16. DESMONTAJE
  desmontaje: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento a Desmontar\n¿Qué elemento o equipo se va a desmontar?',
      chips: () => [
        'Techo de láminas de acerolit',
        'Techo de láminas de zinc',
        'Puertas de madera',
        'Puertas metálicas',
        'Ventanas de aluminio',
        'Rejas metálicas',
        'Luminarias LED',
        'Tuberías de agua',
        'Tuberías sanitarias',
        'Inodoros',
        'Lavamanos',
        'Equipos de aire acondicionado',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'condicion',
      field: 'material',
      text: 'Defina la Condición de Retiro\n¿Se requiere recuperar las piezas desmontadas?',
      chips: () => [
        'Con recuperación de piezas para reutilización',
        'Sin recuperación (desecho a botadero)',
        'Con desconexión eléctrica segura',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de Acopio y Desalojo\n¿Qué traslado de material desmontado incluye?',
      chips: () => [
        'Incluye bajada cuidadosa, retiro y apilado en sitio',
        'Incluye carga y bote fuera de la obra en camión',
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
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('techo')) {
          return ['m² (Metro cuadrado)', 'pza (Pieza)', 'Gl (Suma global)'];
        }
        if (elem.includes('tubería')) {
          return ['ml (Metro lineal)', 'Gl (Suma global)'];
        }
        return ['pza (Pieza)', 'und (Unidad)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 17. REPARACIÓN Y MANTENIMIENTO
  reparacion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento o Falla a Reparar\n¿Qué elemento o instalación presenta la avería?',
      chips: () => [
        'Paredes con fisuras y grietas',
        'Frisos desprendidos o deteriorados',
        'Tuberías de agua potable con filtraciones',
        'Tuberías de aguas servidas obstruidas',
        'Bombas de agua',
        'Motores eléctricos',
        'Rejas metálicas oxidadas',
        'Puertas metálicas',
        'Estructuras metálicas de acero',
        'Tableros eléctricos',
        'Pisos de concreto fisurados',
        'Techos con filtraciones de agua',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'diagnostico_metodo',
      field: 'material',
      text: 'Defina el Método de Reparación\n¿Qué trabajo técnico o sustitución se ejecutará?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('pared') || elem.includes('friso')) {
          return [
            'Picado de friso dañado, resellado de grieta y refrisado con mortero 1:3',
            'Inyección de resina epóxica en fisuras estructurales',
            'Omitir'
          ];
        }
        if (elem.includes('tubería')) {
          return [
            'Sustitución de tramo de tubería dañada con accesorios de compresión',
            'Destape y sondeo mecánico con guaya rotativa',
            'Omitir'
          ];
        }
        if (elem.includes('bomba') || elem.includes('motor')) {
          return [
            'Reemplazo de rodamientos, sellos mecánicos y chequeo eléctrico',
            'Rebobinado de motor y cambio de condensador',
            'Mantenimiento preventivo, limpieza y lubricación',
            'Omitir'
          ];
        }
        if (elem.includes('reja') || elem.includes('puerta') || elem.includes('estructura')) {
          return [
            'Cepillado de óxido, aplicación de fondo anticorrosivo y esmalte',
            'Corte de tramo podrido, soldado de refuerzo y pintura',
            'Omitir'
          ];
        }
        if (elem.includes('tablero')) {
          return [
            'Ajuste de bornes, balanceo de fases y sustitución de breakers defectuosos',
            'Limpieza con solvente dieléctrico y pruebas de aislamiento',
            'Omitir'
          ];
        }
        if (elem.includes('techo')) {
          return [
            'Parcheo focalizado con manto asfáltico y primer',
            'Sellado de juntas con mastique asfáltico y cinta impermeabilizante',
            'Omitir'
          ];
        }
        return [
          'Reparación y ajuste general',
          'Mantenimiento preventivo completo',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('con ') || v.startsWith('mediante ') ? v : `mediante ${v.toLowerCase()}`)
    },
    {
      id: 'alcance',
      field: 'incluye',
      text: 'Defina el Alcance de Repuestos y Pruebas\n¿Qué insumos y garantías contempla el servicio?',
      chips: () => [
        'Incluye materiales, repuestos y mano de obra especializada',
        'Incluye pruebas de funcionamiento y puesta en marcha',
        'Solo mano de obra técnica (repuestos suministrados por el cliente)',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la reparación?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('tubería') || elem.includes('friso') || elem.includes('techo')) {
          return ['pza (Por reparación puntual)', 'ml (Metro lineal)', 'm² (Metro cuadrado)', 'Gl (Suma global)'];
        }
        if (elem.includes('bomba') || elem.includes('motor') || elem.includes('tablero')) {
          return ['und (Unidad)', 'pza (Pieza)', 'Gl (Suma global)'];
        }
        return ['pza (Pieza)', 'und (Unidad)', 'm² (Metro cuadrado)', 'ml (Metro lineal)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 18. RESTAURACIÓN (Patrimonio y acabados nobles)
  restauracion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento Patrimonial o Histórico\n¿Qué elemento o estructura se va a restaurar?',
      chips: () => [
        'Fachadas históricas',
        'Cornisas coloniales',
        'Molduras coloniales',
        'Portones de madera antigua',
        'Ventanas de madera antigua',
        'Rejas de herrería forjada colonial',
        'Muros de mampostería tradicional',
        'Muros de tapia',
        'Muros de adobe',
        'Techos de caña brava',
        'Techos de teja criolla',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'intervencion',
      field: 'material',
      text: 'Defina el Tipo de Intervención de Restauración\n¿Qué técnica de conservación o recuperación se aplicará?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('madera') || elem.includes('portón') || elem.includes('ventana')) {
          return [
            'Decapado manual, tratamiento antipolilla e hidratación con aceites',
            'Sustitución de piezas podridas con madera curada similar',
            'Omitir'
          ];
        }
        if (elem.includes('herrería') || elem.includes('reja')) {
          return [
            'Limpieza química no abrasiva, inhibidor de corrosión y cera microcristalina',
            'Forjado en caliente de piezas faltantes con unión tradicional',
            'Omitir'
          ];
        }
        if (elem.includes('muro') || elem.includes('fachada') || elem.includes('cornisa') || elem.includes('moldura')) {
          return [
            'Consolidación estructural y cosido de grietas con grapas de acero',
            'Limpieza suave con agua nebulizada y cepillo de cerdas naturales',
            'Reintegración de molduras con mortero de cal hidráulica',
            'Omitir'
          ];
        }
        return [
          'Restauración integral respetando técnica constructiva original',
          'Consolidación y reintegración formal',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('mediante ') || v.startsWith('con ') ? v : `mediante ${v.toLowerCase()}`)
    },
    {
      id: 'material',
      field: 'incluye',
      text: 'Defina los Materiales Tradicionales Compatibles\n¿Con qué materiales nobles o morteros se trabajará?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('madera') || elem.includes('portón') || elem.includes('ventana')) {
          return [
            'Con preservantes y aceites naturales para madera',
            'Con goma laca y cera protectora de abeja',
            'Con lasur protector para intemperie',
            'Omitir'
          ];
        }
        if (elem.includes('herrería') || elem.includes('reja')) {
          return [
            'Con inhibidores de corrosión y pasivadores para metal',
            'Con esmalte anticorrosivo acabado forja tradicional',
            'Con cera microcristalina protectora',
            'Omitir'
          ];
        }
        return [
          'Con morteros tradicionales de cal hidráulica y arena lavada',
          'Con pintura a base de cal y pigmentos minerales',
          'Con lechada de cal viva apagada',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'altura_entorno',
      field: 'ubicacion',
      text: 'Defina la Altura y Entorno de Trabajo\n¿Bajo qué condiciones de acceso se restaurará?',
      chips: () => [
        'A nivel de planta baja',
        'En altura con andamios tubulares modulares',
        'En interiores patrimoniales',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la restauración?',
      chips: () => ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'pza (Pieza)', 'Gl (Suma global)'],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 19. SANEAMIENTO
  saneamiento: [
    {
      id: 'zona_problema',
      field: 'elemento',
      text: 'Defina la Zona o Problema a Sanear\n¿Qué área contaminada o saturada requiere saneamiento?',
      chips: () => [
        'Trampas de grasa colapsadas',
        'Fosas sépticas saturadas',
        'Colectores de drenaje obstruidos',
        'Tuberías de aguas servidas colapsadas',
        'Terreno saturado en fondo de excavación',
        'Muros con salitre y humedad ascendente',
        'Taludes inestables',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'metodo',
      field: 'material',
      text: 'Defina el Método de Saneamiento\n¿Cómo se corregirá la patología o contaminación?',
      chips: (answers = {}) => {
        const prob = (answers.zona_problema || '').toLowerCase();
        if (prob.includes('trampa')) {
          return [
            'Vaciado y limpieza profunda con camión váctor',
            'Limpieza manual y extracción de grasas en cuñetes',
            'Hidrolavado a alta presión y succión de lodos',
            'Omitir'
          ];
        }
        if (prob.includes('fosa')) {
          return [
            'Vaciado y succión con camión váctor',
            'Limpieza manual y extracción de lodos digeridos',
            'Omitir'
          ];
        }
        if (prob.includes('colector') || prob.includes('tubería')) {
          return [
            'Desazolve con equipo hidroneumático de alta presión',
            'Vaciado y limpieza profunda con camión váctor',
            'Limpieza mecánica con guayas de acero rotativas',
            'Omitir'
          ];
        }
        if (prob.includes('terreno')) {
          return [
            'Achique continuo con bomba sumergible',
            'Excavación y extracción de fango con retroexcavadora',
            'Omitir'
          ];
        }
        if (prob.includes('muro') || prob.includes('salitre')) {
          return [
            'Picado de friso contaminado, cepillado y lavado a presión',
            'Inyección de barrera química impermeabilizante',
            'Omitir'
          ];
        }
        if (prob.includes('talud')) {
          return [
            'Perfilado de talud y retiro de material inestable',
            'Omitir'
          ];
        }
        return [
          'Limpieza y desinfección profunda',
          'Drenaje y corrección de sustrato',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('mediante ') || v.startsWith('con ') ? v : `mediante ${v.toLowerCase()}`)
    },
    {
      id: 'sustitucion',
      field: 'incluye',
      text: 'Defina el Tratamiento Complementario o Reposición\n¿Qué disposición, desinfección o reposición contempla?',
      chips: (answers = {}) => {
        const prob = (answers.zona_problema || '').toLowerCase();
        if (prob.includes('trampa')) {
          return [
            'Disposición final de grasas en planta autorizada',
            'Desinfección profunda con bactericida y neutralizador de olores',
            'Lavado hidroneumático con desengrasante biodegradable',
            'Sellado interior con mortero hidrófugo',
            'Sustitución de deflector interior en PVC',
            'Suministro y reemplazo de tapa de inspección',
            'Omitir'
          ];
        }
        if (prob.includes('fosa')) {
          return [
            'Disposición y descarga de aguas en planta de tratamiento',
            'Reactivación biológica con bacterias digestoras',
            'Lavado y desinfección profunda de paredes interiores',
            'Sellado e impermeabilización interior con mortero hidrófugo',
            'Omitir'
          ];
        }
        if (prob.includes('colector') || prob.includes('tubería')) {
          return [
            'Inspección con cámara CCTV robotizada poslimpieza',
            'Sustitución de tramo colapsado con tubería de PVC cloacas',
            'Sustitución de tramo colapsado con tubería corrugada de PEAD',
            'Reconstrucción de media caña en boca de visita',
            'Omitir'
          ];
        }
        if (prob.includes('terreno')) {
          return [
            'Reemplazo con pedraplén de piedra picada y geotextil no tejido',
            'Estabilización de fondo con piedra rajón',
            'Colocación de tubería ranurada para drenaje francés',
            'Omitir'
          ];
        }
        if (prob.includes('muro') || prob.includes('salitre')) {
          return [
            'Refrisado con mortero hidrófugo impermeabilizante',
            'Aplicación de fondo antialcalino y sellador antihumedad',
            'Omitir'
          ];
        }
        if (prob.includes('talud')) {
          return [
            'Colocación de geomalla para control de erosión',
            'Construcción de cuneta de coronación en concreto',
            'Siembra de cobertura vegetal estabilizadora',
            'Omitir'
          ];
        }
        return [
          'Desinfección profunda con bactericida',
          'Sellado con mortero hidrófugo',
          'Omitir'
        ];
      },
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el saneamiento?',
      chips: (answers = {}) => {
        const prob = (answers.zona_problema || '').toLowerCase();
        if (prob.includes('trampa')) {
          return ['und (Por trampa)', 'viaje (Por camión váctor)', 'm³ (Metro cúbico)', 'Gl (Suma global)'];
        }
        if (prob.includes('fosa')) {
          return ['und (Por fosa)', 'viaje (Por camión váctor)', 'm³ (Metro cúbico)', 'Gl (Suma global)'];
        }
        if (prob.includes('colector') || prob.includes('tubería')) {
          return ['ml (Metro lineal)', 'm³ (Metro cúbico)', 'Gl (Suma global)'];
        }
        if (prob.includes('muro')) {
          return ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'Gl (Suma global)'];
        }
        return ['m³ (Metro cúbico)', 'm² (Metro cuadrado)', 'ml (Metro lineal)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 20. CONFECCIÓN (Elaboración y habilitado en taller / obra)
  confeccion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento a Confeccionar\n¿Qué pieza o armadura se va a habilitar o fabricar?',
      chips: () => [
        'Armaduras de cabilla para columnas',
        'Armaduras de cabilla para vigas',
        'Armaduras de cabilla para zapatas',
        'Encofrados para vigas',
        'Encofrados para columnas',
        'Encofrados de madera para losas',
        'Rejas de protección metálica',
        'Puertas metálicas',
        'Portones metálicos',
        'Canaletas de lluvia en lámina galvanizada',
        'Bajantes de lluvia en lámina galvanizada',
        'Pasamanos de acero',
        'Barandas de acero',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'material_calibre',
      field: 'material',
      text: 'Defina el Material, Espesor o Calibre\n¿Con qué insumo y dimensiones se confeccionará?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('armadura') || elem.includes('cabilla')) {
          return [
            'Con cabillas corrugadas grado 60 (fy=4200 kg/cm²) y alambre #16',
            'Con cabillas de diámetro 3/8", 1/2" y estribos de 3/8"',
            'Con cabillas de diámetro 5/8" y 3/4"',
            'Omitir'
          ];
        }
        if (elem.includes('encofrado')) {
          return [
            'Con madera de pino cepillada y barrotes 2x4',
            'Con tablero fenólico marino de 15 mm y parales telescópicos',
            'Omitir'
          ];
        }
        if (elem.includes('reja') || elem.includes('puerta') || elem.includes('portón') || elem.includes('pasamano') || elem.includes('baranda')) {
          return [
            'Con tubos estructurales 2x1 y barras cuadradas de 1/2"',
            'Con lámina pulida calibre 18 y perfiles tubulares',
            'Con perfiles de acero inoxidable pulido',
            'Omitir'
          ];
        }
        if (elem.includes('canaleta') || elem.includes('bajante')) {
          return [
            'Con lámina galvanizada calibre 22 con uniones engrapadas y soldadas',
            'Con lámina galvanizada calibre 24 con sellador elástico',
            'Omitir'
          ];
        }
        return [
          'Con perfiles y láminas de acero de primera calidad',
          'Con materiales según especificación de planos',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('con ') || v.startsWith('Con ') ? v : `con ${v}`)
    },
    {
      id: 'lugar_hechura',
      field: 'ubicacion',
      text: 'Defina el Lugar de Confección\n¿Dónde se elaborará la pieza o armadura?',
      chips: () => [
        'Fabricado en banco de trabajo en obra',
        'Fabricado en taller externo con transporte a obra',
        'Confección directa en sitio de instalación',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la confección?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('armadura') || elem.includes('cabilla')) {
          return ['kgf (Kilogramo fuerza)', 'ton (Tonelada)', 'Gl (Suma global)'];
        }
        if (elem.includes('encofrado')) {
          return ['m² (Metro cuadrado de contacto)', 'Gl (Suma global)'];
        }
        if (elem.includes('canaleta') || elem.includes('bajante') || elem.includes('baranda') || elem.includes('pasamano')) {
          return ['ml (Metro lineal)', 'pza (Pieza)', 'Gl (Suma global)'];
        }
        return ['pza (Pieza)', 'm² (Metro cuadrado)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 21. TRATAMIENTO (Superficie / Sustrato específico)
  tratamiento: [
    {
      id: 'sustrato',
      field: 'elemento',
      text: 'Defina el Sustrato o Elemento a Tratar\n¿Qué superficie o material recibirá el tratamiento?',
      chips: () => [
        'Pisos de concreto',
        'Pavimentos de concreto',
        'Estructuras metálicas de acero',
        'Madera para encofrados',
        'Madera de techos machihembrados',
        'Muros de contención enterrados',
        'Juntas de dilatación en pavimentos',
        'Omitir'
      ],
      format: (v) => `en ${v.toLowerCase()}`
    },
    {
      id: 'tipo_tratamiento',
      field: 'material',
      text: 'Defina el Tipo de Tratamiento Químico o Físico\n¿Qué sustancia o protección se aplicará?',
      chips: (answers = {}) => {
        const sus = (answers.sustrato || '').toLowerCase();
        if (sus.includes('concreto') || sus.includes('pavimento')) {
          return [
            'Endurecedor superficial y densificador antipolvo a base de silicato',
            'Membrana de curado químico reflectiva para concreto fresco',
            'Sellador hidrófugo hidrorrepelente a base de silicona',
            'Omitir'
          ];
        }
        if (sus.includes('metálica') || sus.includes('acero')) {
          return [
            'Limpieza abrasiva con chorro de arena (Sandblasting comercial) y fondo anticorrosivo',
            'Convertidor de óxido y pasivador químico fosfatizante',
            'Omitir'
          ];
        }
        if (sus.includes('madera')) {
          return [
            'Preservante insecticida antipolilla y antitérmitas',
            'Impregnante protector fungicida contra pudrición',
            'Desmoldante químico para encofrados de madera',
            'Omitir'
          ];
        }
        if (sus.includes('junta')) {
          return [
            'Sellado elástico con masilla de poliuretano de alto desempeño',
            'Sellado con masilla asfáltica aplicada en caliente',
            'Omitir'
          ];
        }
        return [
          'Tratamiento hidrófugo repelente al agua',
          'Tratamiento químico anticorrosivo',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('con ') || v.startsWith('Con ') ? v : `con ${v}`)
    },
    {
      id: 'metodo_aplicacion',
      field: 'ubicacion',
      text: 'Defina el Método de Aplicación\n¿Cómo se aplicará el producto?',
      chips: () => [
        'Con equipo aspersor',
        'Con compresor de aire industrial',
        'Con brocha',
        'Con rodillo de pelo corto',
        'Con pistola de calafateo manual',
        'Por inyección a presión',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el tratamiento?',
      chips: (answers = {}) => {
        const sus = (answers.sustrato || '').toLowerCase();
        if (sus.includes('junta')) {
          return ['ml (Metro lineal)', 'Gl (Suma global)'];
        }
        return ['m² (Metro cuadrado)', 'ml (Metro lineal)', 'pza (Pieza)', 'Gl (Suma global)'];
      },
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
      'Paredes de bloques de arcilla',
      'Paredes de bloques de concreto',
      'Columnas',
      'Vigas',
      'Losas de concreto',
      'Pisos de concreto',
      'Pavimentos de concreto',
      'Tuberías',
      'Estructuras metálicas de acero',
      'Brocales',
      'Bordillos',
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
      'Perfiles de acero estructural',
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
