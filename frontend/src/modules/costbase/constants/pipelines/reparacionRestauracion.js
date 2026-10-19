// Pipelines de reparacionRestauracion — extraídos de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
export const PIPELINES = {
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
};
