// Pipelines de demolicionYRemocion — extraídos de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
export const PIPELINES = {
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
};
