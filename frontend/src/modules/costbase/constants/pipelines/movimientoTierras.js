// Pipelines de movimientoTierras — extraídos de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
export const PIPELINES = {
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
};
