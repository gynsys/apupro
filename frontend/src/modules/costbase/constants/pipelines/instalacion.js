// Pipelines de instalacion — extraídos de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
export const PIPELINES = {
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
};
