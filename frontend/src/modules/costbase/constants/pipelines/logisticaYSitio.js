// Pipelines de logisticaYSitio — extraídos de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
export const PIPELINES = {
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
};
