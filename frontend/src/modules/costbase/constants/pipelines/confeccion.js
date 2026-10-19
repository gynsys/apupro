// Pipelines de confeccion — extraídos de actionPipelines.js
import { extractCleanUnit } from '../helpers.js';
export const PIPELINES = {
  confeccion: [
    {
      id: 'elemento',
      field: 'elemento',
      text: 'Defina el Elemento a Confeccionar\n¿Qué pieza o armadura se va a habilitar o fabricar?',
      chips: () => [
        'Armaduras de cabilla para columnas',
        'Armaduras de cabilla para vigas',
        'Armaduras de cabilla para zapatas',
        'Encofrados para vigas',
        'Encofrados para columnas',
        'Encofrados de madera para losas',
        'Rejas de protección metálica',
        'Puertas metálicas',
        'Portones metálicos',
        'Canaletas de lluvia en lámina galvanizada',
        'Bajantes de lluvia en lámina galvanizada',
        'Pasamanos de acero',
        'Barandas de acero',
        'Omitir'
      ],
      format: (v) => `de ${v.toLowerCase()}`
    },
    {
      id: 'material_calibre',
      field: 'material',
      text: 'Defina el Material, Espesor o Calibre\n¿Con qué insumo y dimensiones se confeccionará?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('armadura') || elem.includes('cabilla')) {
          return [
            'Con cabillas corrugadas grado 60 (fy=4200 kg/cm²) y alambre #16',
            'Con cabillas de diámetro 3/8", 1/2" y estribos de 3/8"',
            'Con cabillas de diámetro 5/8" y 3/4"',
            'Omitir'
          ];
        }
        if (elem.includes('encofrado')) {
          return [
            'Con madera de pino cepillada y barrotes 2x4',
            'Con tablero fenólico marino de 15 mm y parales telescópicos',
            'Omitir'
          ];
        }
        if (elem.includes('reja') || elem.includes('puerta') || elem.includes('portón') || elem.includes('pasamano') || elem.includes('baranda')) {
          return [
            'Con tubos estructurales 2x1 y barras cuadradas de 1/2"',
            'Con lámina pulida calibre 18 y perfiles tubulares',
            'Con perfiles de acero inoxidable pulido',
            'Omitir'
          ];
        }
        if (elem.includes('canaleta') || elem.includes('bajante')) {
          return [
            'Con lámina galvanizada calibre 22 con uniones engrapadas y soldadas',
            'Con lámina galvanizada calibre 24 con sellador elástico',
            'Omitir'
          ];
        }
        return [
          'Con perfiles y láminas de acero de primera calidad',
          'Con materiales según especificación de planos',
          'Omitir'
        ];
      },
      format: (v) => (v.startsWith('con ') || v.startsWith('Con ') ? v : `con ${v}`)
    },
    {
      id: 'lugar_hechura',
      field: 'ubicacion',
      text: 'Defina el Lugar de Confección\n¿Dónde se elaborará la pieza o armadura?',
      chips: () => [
        'Fabricado en banco de trabajo en obra',
        'Fabricado en taller externo con transporte a obra',
        'Confección directa en sitio de instalación',
        'Omitir'
      ],
      format: (v) => v
    },
    {
      id: 'unidad',
      field: 'unidad',
      isUnit: true,
      text: 'Defina la Unidad de Medida\n¿En qué unidad se computará la confección?',
      chips: (answers = {}) => {
        const elem = (answers.elemento || '').toLowerCase();
        if (elem.includes('armadura') || elem.includes('cabilla')) {
          return ['kgf (Kilogramo fuerza)', 'ton (Tonelada)', 'Gl (Suma global)'];
        }
        if (elem.includes('encofrado')) {
          return ['m² (Metro cuadrado de contacto)', 'Gl (Suma global)'];
        }
        if (elem.includes('canaleta') || elem.includes('bajante') || elem.includes('baranda') || elem.includes('pasamano')) {
          return ['ml (Metro lineal)', 'pza (Pieza)', 'Gl (Suma global)'];
        }
        return ['pza (Pieza)', 'm² (Metro cuadrado)', 'Gl (Suma global)'];
      },
      format: (v) => `unidad ${extractCleanUnit(v)}`
    }
  ],

  // 21. TRATAMIENTO (Superficie / Sustrato específico)
};
