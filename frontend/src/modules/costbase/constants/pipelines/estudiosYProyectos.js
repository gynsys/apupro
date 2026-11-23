// Pipelines de estudios y proyectos (Capítulo E0 COVENIN)
import { extractCleanUnit } from '../helpers.js';

export const PIPELINES = {
  estudio: [
    {
      id: 'tipo_estudio',
      field: 'elemento',
      text: 'Defina el Tipo de Estudio o Proyecto\n¿Qué tipo de estudio técnico o proyecto se va a realizar?',
      chips: () => [
        'Estudio de suelos y geotecnia',
        'Levantamiento topográfico planialtimétrico',
        'Estudios preliminares de implantación',
        'Estudio de impacto ambiental',
        'Proyecto de arquitectura',
        'Proyecto de cálculo estructural',
        'Proyecto de instalaciones sanitarias y eléctricas',
        'Sondeos y ensayos de penetración estándar (SPT)',
        'Evaluación patológica y estructural',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'alcance_metodo',
      field: 'material',
      text: 'Defina el Alcance y Metodología\n¿Qué alcance técnico o metodología incluye?',
      chips: (answers = {}) => {
        const tipo = (answers.tipo_estudio || '').toLowerCase();
        if (tipo.includes('suelo') || tipo.includes('geotecn') || tipo.includes('spt')) {
          return [
            'Con perforaciones a máquina y ensayos de laboratorio SPT',
            'Con calicatas a cielo abierto y toma de muestras',
            'Incluye informe geotécnico y recomendaciones de fundación',
            'Omitir'
          ];
        }
        if (tipo.includes('topograf')) {
          return [
            'Con estación total y nivelación de precisión',
            'Con GPS geodésico y curvas de nivel a cada metro',
            'Perimetral y altimétrico con estacas de replanteo',
            'Omitir'
          ];
        }
        return [
          'A nivel de anteproyecto con memoria descriptiva',
          'A nivel de proyecto ejecutivo con planos y especificaciones',
          'Con entrega de informe técnico avalado por ingeniero colegiado',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('con ') || v.startsWith('incluye ') ? v.toLowerCase() : `con ${v.toLowerCase()}`)
    },
    {
      id: 'ubicacion_tipo_obra',
      field: 'ubicacion',
      text: 'Defina el Destino o Edificación de Aplicación\n¿Para qué tipo de edificación o desarrollo?',
      chips: () => [
        'Para vivienda unifamiliar / multifamiliar',
        'Para edificación comercial / oficinas',
        'Para edificación industrial / galpón',
        'Para edificación médico-asistencial / educacional',
        'Para urbanismo o vialidad',
        'En terreno libre / zona rural',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará el estudio o proyecto?',
      chips: () => [
        'pto (Por punto / sondeo realizado)',
        'm² (Por metro cuadrado de área)',
        'ha (Por hectárea de terreno)',
        'km (Por kilómetro de desarrollo)',
        'm (Por metro lineal de perforación)',
        'und (Por informe / estudio completo)',
        'Gl (Suma global del servicio)'
      ],
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ]
};
