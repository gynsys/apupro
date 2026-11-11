/**
 * Documentación de medición y pago por capítulo / subcapítulo.
 *
 * La norma COVENIN-MINDUR 2000-2:1999 documenta criterios por capítulo y
 * subcapítulo, no por cada código de partida. La partida hereda la ficha del
 * subcapítulo cuando existe; si no, la del capítulo.
 *
 * Esta primera versión es local al frontend. Cuando exista la tabla
 * partida_documentacion en el backend, este módulo se reemplaza por la API.
 */

export const CHAPTER_DOCUMENTATION = {
  E1: {
    code: 'E1',
    level: 'chapter',
    title: 'Obras preliminares',
    alcance:
      'Comprende las instalaciones provisionales, la limpieza del terreno, las demoliciones y las remociones necesarias para iniciar la obra.',
    medicion:
      'Se mide por la unidad indicada en cada partida: m² para instalaciones y limpieza, m³ para demoliciones y remociones. Se computa la cantidad realmente ejecutada según el alcance de la partida.',
    inclusiones: [
      'Suministro, transporte y colocación cuando la partida lo indique.',
      'Retiro y bote de los materiales producto de la actividad.',
    ],
    exclusiones: [
      'El transporte final se rige por el capítulo E9 cuando corresponda.',
      'Los trabajos no contemplados requieren partida adicional aprobada.',
    ],
    pago:
      'La norma regula la medición. La forma de pago se define en las condiciones del contrato: precio unitario por cantidad medida y aprobada.',
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 19-35',
  },
  E3: {
    code: 'E3',
    level: 'chapter',
    title: 'Estructuras',
    alcance:
      'Comprende la infraestructura y la superestructura de concreto, así como las estructuras metálicas de la edificación.',
    medicion:
      'Se mide el volumen, área o longitud realmente ejecutada según la partida. Se descuentan los vacíos y las intersecciones se computan una sola vez. El concreto se mide en m³; el acero en kg; los encofrados en m².',
    inclusiones: [
      'Concreto, acero de refuerzo, encofrado y acabados según el alcance de cada partida.',
      'Pruebas y controles de calidad exigidos por la especificación.',
    ],
    exclusiones: [
      'El transporte de materiales y equipos se paga por el capítulo E9.',
      'Los trabajos de otras especialidades se documentan en su capítulo.',
    ],
    pago:
      'Se paga por precio unitario aplicado a la cantidad medida y aprobada. La norma no fija condiciones contractuales de pago; estas provienen del contrato.',
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 37-63',
  },
  E4: {
    code: 'E4',
    level: 'chapter',
    title: 'Obras arquitectónicas',
    alcance:
      'Comprende los acabados y elementos arquitectónicos de la edificación, incluida la impermeabilización.',
    medicion:
      'Se mide el área neta realmente ejecutada, descontando vacíos y áreas descontables. Los remates se incluyen en la partida correspondiente y se consideran en el rendimiento.',
    inclusiones: [
      'Suministro, transporte y colocación de los materiales de acabado.',
      'Preparación de la superficie y remates previstos en la partida.',
    ],
    exclusiones: [
      'La estructura y el transporte se documentan en E3 y E9 respectivamente.',
    ],
    pago:
      'Precio unitario por área o unidad medida. La forma de pago particular se define en el contrato.',
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 64-74',
  },
  E6: {
    code: 'E6',
    level: 'chapter',
    title: 'Instalaciones sanitarias y especiales',
    alcance:
      'Comprende tuberías, puntos sanitarios, llaves de paso, piezas especiales, registros y artefactos sanitarios.',
    medicion:
      'Las instalaciones se miden una vez ejecutadas y probadas. Los puntos sanitarios se miden por punto; las tuberías por longitud; los artefactos por unidad. Se incluyen conexiones y remates según la partida.',
    inclusiones: [
      'Materiales, conexiones, pruebas de presión y remates.',
      'Transporte hasta el sitio de la obra cuando la partida lo incluya.',
    ],
    exclusiones: [
      'Obras civiles complementarias no incluidas en la partida.',
      'Equipos especiales fuera del alcance del capítulo.',
    ],
    pago:
      'Precio unitario por punto, longitud o unidad instalada y probada. Las condiciones de pago se rigen por el contrato.',
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 75-101',
  },
  E9: {
    code: 'E9',
    level: 'chapter',
    title: 'Transportes',
    alcance:
      'Comprende el transporte de materiales, maquinaria y escombros asociados a las obras de la edificación.',
    medicion:
      'El transporte se mide una sola vez, de origen a destino. Las partidas de transporte son excluyentes entre sí. Los escombros y agregados se miden en estado suelto, sobre camión, en m³·km o m²·km según corresponda.',
    inclusiones: [
      'Carga, transporte y descarga según el alcance de la partida.',
    ],
    exclusiones: [
      'No se reconocen dos partidas de transporte para una misma operación.',
    ],
    pago:
      'Precio unitario por distancia y volumen/peso transportado. La norma no fija la forma contractual de pago.',
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 102-126',
  },
};

export const SUBCHAPTER_DOCUMENTATION = {
  E11: {
    code: 'E11',
    level: 'subchapter',
    title: 'Instalaciones provisionales',
    alcance:
      'Construcciones provisionales necesarias para el desarrollo de la obra: oficinas, depósitos, vestuarios, casetas, sanitarios y cercas.',
    medicion:
      'Las construcciones se miden por m² de área útil. Las cercas se miden por metro lineal. Los portones se miden por m².',
    inclusiones: ['Estructura, cerramientos, pisos y acabados indicados en la partida.'],
    exclusiones: ['Transporte y retiro final de la instalación, salvo que la partida lo incluya.'],
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 19-21',
  },
  E12: {
    code: 'E12',
    level: 'subchapter',
    title: 'Limpieza del terreno',
    alcance:
      'Deforestación, tala de vegetación herbácea y desraizamiento de árboles individuales.',
    medicion:
      'La deforestación y la limpieza se miden por hectárea (ha) o por metro cuadrado según la partida. La tala de árboles individuales se mide por unidad.',
    inclusiones: ['Corte, desraizamiento, acarreo y eliminación del material.'],
    exclusiones: ['Transporte fuera del sitio, que se rige por E9.'],
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 22-23',
  },
  E13: {
    code: 'E13',
    level: 'subchapter',
    title: 'Demoliciones',
    alcance:
      'Fragmentación de una edificación o parte de ella para transportar los escombros al sitio de disposición final.',
    medicion:
      'Se mide el volumen de material demolido en m³, o la unidad indicada en la partida. Se computa el volumen real ejecutado.',
    inclusiones: ['Demolición, limpieza y apilamiento del material.'],
    exclusiones: ['Transporte y disposición final, que se pagan por E9.'],
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 24',
  },
  E14: {
    code: 'E14',
    level: 'subchapter',
    title: 'Remociones',
    alcance:
      'Desmontaje o desarme de elementos sin afectar sus características principales, para su eventual reutilización.',
    medicion:
      'Se mide por unidad o por la unidad indicada en la partida, según el elemento removido.',
    inclusiones: ['Desmontaje, protección y entrega del elemento removido.'],
    exclusiones: ['Transporte y almacenamiento fuera de la obra, salvo indicación contraria.'],
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 25-28',
  },
  E33: {
    code: 'E33',
    level: 'subchapter',
    title: 'Superestructura de concreto',
    alcance:
      'Elementos de concreto armado por encima de la cota superior del pedestal o de la viga de riostra: columnas, vigas, losas, paredes y escaleras.',
    medicion:
      'El concreto se mide por volumen real en m³. El acero de refuerzo se mide por peso en kg. El encofrado se mide por área de contacto en m². Se descuentan vacíos y las intersecciones se cuentan una sola vez.',
    inclusiones: [
      'Concreto, acero de refuerzo, encofrado y acabados según la partida.',
      'Curado y pruebas de resistencia cuando corresponda.',
    ],
    exclusiones: [
      'Excavaciones y rellenos, que corresponden al capítulo E2.',
      'Transporte de materiales, que se paga por E9.',
    ],
    pago:
      'Precio unitario por m³, kg o m² medido y aprobado. Las condiciones contractuales de pago se definen en el contrato.',
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 39-43',
  },
  E42: {
    code: 'E42',
    level: 'subchapter',
    title: 'Impermeabilización',
    alcance:
      'Trabajos de impermeabilización de cubiertas, losas, muros y áreas húmedas.',
    medicion:
      'Se mide por m² de superficie tratada, incluyendo remates y solapes según la partida.',
    inclusiones: ['Preparación de la superficie, material impermeabilizante y remates.'],
    exclusiones: ['Estructura y mortero base, salvo que la partida los incluya.'],
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 64-74',
  },
  E61: {
    code: 'E61',
    level: 'subchapter',
    title: 'Tuberías',
    alcance:
      'Tuberías de aguas claras, residuales y especiales, con sus conexiones.',
    medicion:
      'Se mide por longitud en metros lineales, según diámetro y material. Se incluyen conexiones y pruebas.',
    inclusiones: ['Tubería, conexiones, soportería y pruebas.'],
    exclusiones: ['Excavación y relleno de zanjas, que corresponden a E3.'],
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 77-78',
  },
  E62: {
    code: 'E62',
    level: 'subchapter',
    title: 'Puntos sanitarios',
    alcance:
      'Puntos de aguas claras y residuales, incluyendo tubos y conexiones dentro de los recintos sanitarios.',
    medicion:
      'Se mide por punto sanitario, según el diámetro de la tubería de alimentación o descarga. Se incluyen conexiones y pruebas.',
    inclusiones: ['Materiales, conexiones, pruebas de presión y remates.'],
    exclusiones: ['Artefactos sanitarios, que se miden por E66.'],
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 79-80',
  },
  E66: {
    code: 'E66',
    level: 'subchapter',
    title: 'Artefactos sanitarios',
    alcance:
      'Suministro e instalación de artefactos sanitarios y sus accesorios.',
    medicion:
      'Se mide por unidad instalada y probada, según el tipo de artefacto.',
    inclusiones: ['Artefacto, accesorios, conexiones y pruebas.'],
    exclusiones: ['Puntos sanitarios, que se miden por E62.'],
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 82-90',
  },
  E90: {
    code: 'E90',
    level: 'subchapter',
    title: 'Transporte de tierra, agregados y escombros',
    alcance:
      'Transporte y bote de material proveniente de demoliciones, remociones, excavaciones y agregados.',
    medicion:
      'Se mide en m³·km, en estado suelto sobre camión. La distancia se mide de origen a destino. Es excluyente con otras partidas de transporte.',
    inclusiones: ['Carga, transporte y descarga según la partida.'],
    exclusiones: ['Otra partida de transporte para la misma operación.'],
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 105-106',
  },
};

export function getPartidaDocumentacion(item) {
  const code = String(item?.CovPar || item?.CodPar || '').trim().toUpperCase();
  const match = code.match(/^E(\d)(\d{2})/);
  if (!match) return null;

  const chapterCode = `E${match[1]}`;
  const subchapterCode = `E${match[2]}`;
  const chapter = CHAPTER_DOCUMENTATION[chapterCode];
  const subchapter = SUBCHAPTER_DOCUMENTATION[subchapterCode];
  const doc = subchapter || chapter;

  if (!doc) return null;

  return {
    ...doc,
    chapter,
    subchapter,
    inheritedFrom: subchapter ? subchapter.code : chapter?.code,
    inheritedLabel: subchapter
      ? `Heredado de ${subchapter.code} · ${subchapter.title}`
      : `Heredado de ${chapter?.code} · ${chapter?.title}`,
  };
}
