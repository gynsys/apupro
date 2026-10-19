// Pipelines de recubrimientos — extraídos de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
export const PIPELINES = {
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
