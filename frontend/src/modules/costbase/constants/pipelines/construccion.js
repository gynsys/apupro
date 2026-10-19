// Pipelines de construccion — extraídos de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
export const PIPELINES = {
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
};
