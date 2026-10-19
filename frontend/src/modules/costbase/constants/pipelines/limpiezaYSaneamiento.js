// Pipelines de limpiezaYSaneamiento — extraídos de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
export const PIPELINES = {
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
};
