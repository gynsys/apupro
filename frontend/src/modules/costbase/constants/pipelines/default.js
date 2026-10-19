// Pipeline por defecto — extraído de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
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
