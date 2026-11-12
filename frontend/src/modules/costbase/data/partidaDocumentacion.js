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
    pago: {
      hito: 'Hito COVENIN (Art. 2.7 y Cap. E1): Las partidas se consideran ejecutadas y se valúan para pago tras la culminación total de la instalación provisional, demolición o limpieza del área.',
      criterio: 'Precio unitario aplicado a la cantidad neta realmente ejecutada (m² de área útil en construcciones provisionales, m en cercas, m³ en demoliciones y ha o m² en deforestación).',
      inclusiones: [
        'Suministro, transporte a pie de obra, montaje y desmontaje de instalaciones provisionales.',
        'Mano de obra, herramientas, nivelación y replanteo local de la zona.',
        'Acopio y retiro de desperdicios producto de la labor.',
      ],
      condiciones: 'El transporte fuera del sitio de la obra se rige por el capítulo E9. La construcción de vallas publicitarias no se reconoce como partida pagable (forma parte de los gastos generales de la empresa contratista según el Art. 2.7).',
    },
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
    pago: {
      hito: 'Hito COVENIN (Art. 2.7): El concreto se valúa por volumen colocado y curado a los 28 días; el acero de refuerzo se reconoce ÚNICAMENTE una vez vaciado el concreto; los encofrados se reconocen ÚNICAMENTE una vez desencofrado el elemento.',
      criterio: 'Precio unitario por m³ (concreto), kgf (acero) o m² (encofrado). Se descuentan todos los vacíos e intersecciones. Si una cara es obra limpia, todo el volumen se computa y paga como obra limpia.',
      inclusiones: [
        'Materiales componentes, mezclado, vaciado, vibrado y curado del concreto.',
        'Pruebas y ensayos de control de calidad (probetas cilíndricas de concreto a compresión).',
        'Desperdicios de materiales absorbidos dentro del análisis de precios unitarios (no medibles en obra).',
      ],
      condiciones: 'La armadura de refuerzo (E35), encofrados (E34) y transportes (E9) se pagan por partidas separadas. El uso de concreto premezclado no genera derecho a incremento de precio unitario.',
    },
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
    pago: {
      hito: 'Hito COVENIN (Art. 2.7 y Cap. E4): Se valúa y paga por superficie o unidad neta ejecutada, con acabados y remates completamente concluidos y aprobados por la inspección.',
      criterio: 'Precio unitario por área en verdadero desarrollo (m²), longitud (m) o pieza (un). Se descuentan estrictamente todos los vanos y vacíos (puertas, ventanas, columnas embebidas).',
      inclusiones: [
        'Suministro, acarreo interno y colocación de materiales de revestimiento y acabados.',
        'Preparación de superficie, remates de esquinas y juntas de dilatación.',
        'Limpieza final y retiro de desperdicios de la jornada.',
      ],
      condiciones: 'En carpintería y herrería se contratarán ventanas con vidrios incluidos. Partidas de ventanas sin vidrios y vidrios por separado son de uso excepcional justificado en memoria técnica.',
    },
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
    pago: {
      hito: 'Hito COVENIN (Art. 2.7 y Cap. E6): Las partidas se consideran ejecutadas y se autoriza su pago ÚNICAMENTE una vez colocadas y probadas satisfactoriamente (presión hidrostática y estanqueidad).',
      criterio: 'Precio unitario por punto sanitario (pto), longitud instalada (m) o artefacto colocado y conectado (un).',
      inclusiones: [
        'Tuberías, conexiones, soportes, soldaduras, pegamentos, pruebas de estanqueidad y remates.',
        'Transporte de materiales y piezas hasta el sitio de la obra.',
      ],
      condiciones: 'Las partidas de válvulas, llaves de paso y piezas especiales (E63/E64) solo se reconocerán para pago una vez completada su instalación. Sépticos, sumideros y tanquillas se pagan por el capítulo E8.',
    },
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
    pago: {
      hito: 'Hito COVENIN (Art. 2.13 y Cap. E9): Se valúa y paga por viaje o tonelaje efectivamente transportado y descargado en el sitio autorizado, con guías de transporte conformadas por la inspección.',
      criterio: 'Precio unitario por m³·km o t·km según el material transportado y la distancia real recorrida medida de origen a destino sobre camión en estado suelto.',
      inclusiones: [
        'Carga, viaje y descarga de materiales, maquinaria o escombros.',
        'Mantenimiento y combustible del equipo de transporte.',
      ],
      condiciones: 'Las partidas de transporte son estrictamente excluyentes entre sí. No se reconocerán dos partidas de transporte para una misma operación ni fletes de materiales cuyo APU ya contemple el transporte incluido.',
    },
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
    pago: {
      hito: 'Hito COVENIN: Se valúa y paga tras finalizar la construcción provisional y ser puesta en servicio para la inspección o cuadrilla de obra.',
      criterio: 'Precio unitario por m² de área útil techada o metro lineal de cerca perimetral.',
      inclusiones: ['Estructuras, cerramientos, puertas, ventanas, techos, pisos e instalaciones de servicio básico.'],
      condiciones: 'El contratante pagará su demolición, carga y transporte al cierre de obra solo si está expresamente contratado.',
    },
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
    pago: {
      hito: 'Hito COVENIN: Se valúa por área deforestada y desraizada libre de vegetación, aprobada por la inspección de obra.',
      criterio: 'Precio unitario por hectárea (ha), m² o unidad de árbol talado.',
      inclusiones: ['Tala, desraizamiento, apilamiento y quema o disposición autorizada dentro de la obra.'],
      condiciones: 'La carga y transporte de desperdicios fuera de la obra se mide y paga por los grupos E903.',
    },
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
    pago: {
      hito: 'Hito COVENIN: Se valúa por volumen de elemento efectivamente demolido y clasificado en sitio.',
      criterio: 'Precio unitario por metro cúbico (m³) o metro cuadrado (m²) de elemento en su condición original.',
      inclusiones: ['Mano de obra, uso de compresores, martillos, apuntalamiento preventivo y acopio.'],
      condiciones: 'El esponjamiento no se paga en la partida de demolición. El transporte de escombros se liquida por E9.',
    },
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
    pago: {
      hito: 'Hito COVENIN: Se valúa una vez desmontada la pieza cuidadosamente y entregada a la inspección para su custodia.',
      criterio: 'Precio unitario por pieza (un), metro lineal (m) o metro cuadrado (m²).',
      inclusiones: ['Desmontaje cuidadoso, protección, etiquetado y depósito dentro de la obra.'],
      condiciones: 'Elementos dañados por impericia del contratista no generan pago y deberán ser repuestos a su costo.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 25-28',
  },
  E32: {
    code: 'E32',
    level: 'subchapter',
    title: 'Infraestructura de concreto',
    alcance:
      'Obras de concreto en fundaciones, zapatas, pedestales, losas de fundación y muros de sótano.',
    medicion:
      'Se mide el volumen real en m³. La armadura de refuerzo y el encofrado se computan por partidas separadas.',
    inclusiones: ['Materiales, mezclado, vaciado, vibrado, curado y ensayos de compresión.'],
    exclusiones: ['Armadura de refuerzo (E35), encofrados (E34) y transporte de agregados (E9).'],
    pago: {
      hito: 'Hito COVENIN (Art. 2.7 y Cap. E3): Se valúa por volumen vaciado y curado, condicionado a los resultados de probetas cilíndricas a los 28 días.',
      criterio: 'Precio unitario por metro cúbico (m³) de concreto en fundaciones, zapatas, losas de fundación o pedestales.',
      inclusiones: ['Elaboración, transporte interno, vaciado, vibrado, curado y ensayos de probetas.'],
      condiciones: 'Encofrados (E34) y acero de refuerzo (E35) se miden y pagan por partidas separadas.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 38',
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
      'Concreto, curado y pruebas de resistencia cilíndrica cuando corresponda.',
    ],
    exclusiones: [
      'Excavaciones y rellenos, que corresponden al capítulo E2.',
      'Armaduras (E35), encofrados (E34) y transportes (E9).',
    ],
    pago: {
      hito: 'Hito COVENIN (Art. 2.7 y Cap. E3): Se valúa por volumen colocado y curado a partir de la cota superior de fundación, sujeto a verificación de resistencia a 28 días.',
      criterio: 'Precio unitario por metro cúbico (m³). Todo el volumen se valúa como obra limpia si alguna cara lo especifica.',
      inclusiones: ['Mezclado, vaciado, vibrado, curado y pruebas de resistencia cilíndrica.'],
      condiciones: 'Armaduras (E35), encofrados (E34) y transporte de agregados (E9) se pagan por separado.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 39-43',
  },
  E34: {
    code: 'E34',
    level: 'subchapter',
    title: 'Encofrados',
    alcance:
      'Moldes y formaletas provisionales de madera o metal para contener y moldear el concreto fresco durante el vaciado y fraguado.',
    medicion:
      'Se mide el área de contacto real en m² entre el encofrado y el concreto. No se miden áreas fuera de contacto ni traslapes.',
    inclusiones: ['Paneles, tirantes, desmoldantes, apuntalamientos y mano de obra de armado y desencofrado.'],
    exclusiones: ['El concreto y el acero de refuerzo se pagan en sus partidas respectivas.'],
    pago: {
      hito: 'Hito COVENIN (Art. 2.7): Las partidas de encofrados se consideran ejecutadas y se pagan ÚNICAMENTE una vez desencofrado el elemento estructural.',
      criterio: 'Precio unitario por metro cuadrado (m²) de área de contacto real entre la formaleta y el concreto.',
      inclusiones: ['Paneles de madera o metal, apuntalamiento, cerchas, desmoldante y mano de obra de armado y desencofrado.'],
      condiciones: 'No se reconoce pago anticipado por encofrado armado antes de desencofrar salvo estipulación particular del contrato.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 37-43',
  },
  E35: {
    code: 'E35',
    level: 'subchapter',
    title: 'Armaduras de refuerzo',
    alcance:
      'Suministro, corte, doblado y colocación de cabillas y mallas electrosoldadas para concreto armado.',
    medicion:
      'Se mide por peso en kilogramos-fuerza (kgf) calculado a partir de la planilla de corte y despiece del proyecto.',
    inclusiones: ['Cabillas, corte, doblado, alambre de amarre, silletas, separadores y desperdicios normales.'],
    exclusiones: ['El concreto y el encofrado se computan por separado.'],
    pago: {
      hito: 'Hito COVENIN (Art. 2.7): Las partidas de armaduras de refuerzo se consideran ejecutadas y se pagan ÚNICAMENTE una vez vaciado el concreto.',
      criterio: 'Precio unitario por kilogramo-fuerza (kgf) según peso nominal de planilla de corte sin incluir alambre de amarre.',
      inclusiones: ['Suministro, corte, doblado, armado, colocación, alambre de amarre, silletas, separadores y desperdicios.'],
      condiciones: 'En cierres de contrato, los arranques de cabillas expuestos solo se reconocen si están protegidos con pintura anticorrosiva aprobada.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 37-43',
  },
  E36: {
    code: 'E36',
    level: 'subchapter',
    title: 'Estructuras metálicas',
    alcance:
      'Miembros y piezas de acero o aluminio estructural: columnas, vigas, cerchas, planchas y correas.',
    medicion:
      'Se mide por peso en kgf según peso unitario nominal (perfiles: 7850 kgf/m³, planchas lisas: 8000 kgf/m³).',
    inclusiones: ['Material metálico, soldaduras, pernos, fabricación en taller y montaje en obra.'],
    exclusiones: ['Obras civiles de concreto en pedestales y fundaciones.'],
    pago: {
      hito: 'Hito COVENIN (Cap. E3): Se valúa según la etapa contratada: E36X1 (Suministro), E36X2 (Fabricación en taller), E36X3 (Limpieza/Superficies), E36X4 (Pintura), E36X5 (Montaje en sitio), o integral en E36X6.',
      criterio: 'Precio unitario por kilogramo-fuerza (kgf) según peso teórico calculado (perfiles: 7850 kgf/m³, planchas lisas: 8000 kgf/m³).',
      inclusiones: ['Materiales metálicos, soldaduras, pernos, corte, fabricación, ensayos no destructivos y montaje.'],
      condiciones: 'Las planchas que conforman perfiles soldados se pagan como perfil, no como planchas individuales E36112.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 40-63',
  },
  E41: {
    code: 'E41',
    level: 'subchapter',
    title: 'Obras de albañilería',
    alcance:
      'Paredes de bloques de arcilla o concreto, tabiques y elementos de mampostería no estructural.',
    medicion:
      'Se mide el área neta en m², descontando estrictamente vanos de puertas, ventanas, vigas y columnas embebidas.',
    inclusiones: ['Bloques, mortero de pega, mano de obra, andamios internos y limpieza de rebabas.'],
    exclusiones: ['Revestimientos y frisos (E43) y estructura de concreto (E3).'],
    pago: {
      hito: 'Hito COVENIN (Cap. E4): Se valúa por área neta de pared construida, con juntas trabadas y rematadas, aplomadas y limpias.',
      criterio: 'Precio unitario por metro cuadrado (m²), descontando estrictamente vanos de puertas, ventanas, vigas y columnas embebidas.',
      inclusiones: ['Bloques de arcilla/concreto, mortero de pega, mano de obra, andamios internos y limpieza de rebabas.'],
      condiciones: 'El transporte de bloques se rige por E906/E907 si la partida lo excluye expresamente.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 64-69',
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
    pago: {
      hito: 'Hito COVENIN (Cap. E4): Se valúa tras la aplicación completa del sistema multicapa o membrana y superada la prueba de inundación (mínimo 48 horas sin filtraciones).',
      criterio: 'Precio unitario por metro cuadrado (m²) de superficie tratada en verdadero desarrollo.',
      inclusiones: ['Imprimación, membranas asfálticas o elastoméricas, solapes mínimos de 10 cm, remates en antepechos y prueba de agua.'],
      condiciones: 'La pendiente mínima y mortero de base deben ser verificados antes de autorizar el pago.',
    },
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
    pago: {
      hito: 'Hito COVENIN (Art. 2.7 y Cap. E6): Se valúa ÚNICAMENTE una vez tendida la tubería, conectada y superada la prueba hidrostática de presión sin fugas.',
      criterio: 'Precio unitario por metro lineal (m) instalado y probado, medido entre centros de conexiones o caras externas de artefactos.',
      inclusiones: ['Tubería, juntas, pegamentos, abrazaderas, soportería, desperdicios y pruebas hidrostáticas.'],
      condiciones: 'Protecciones de concreto o pinturas asfálticas para paso de muros se miden en sus capítulos respectivos.',
    },
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
    pago: {
      hito: 'Hito COVENIN (Cap. E6): Se valúa por punto completado y probado dentro del recinto sanitario, hasta el codo o boca de salida/descarga.',
      criterio: 'Precio unitario por punto sanitario (pto) según diámetro y tipo de aguas (claras, servidas o lluvia).',
      inclusiones: ['Tramos de tubería y conexiones internas al recinto sanitario, pegamentos, tapones provisionales y pruebas.'],
      condiciones: 'Los artefactos sanitarios (poceta, lavamanos) se miden y pagan por E66.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 79-80',
  },
  E63: {
    code: 'E63',
    level: 'subchapter',
    title: 'Llaves de paso y válvulas',
    alcance:
      'Válvulas de compuerta, llaves de paso, grifos y medidores de alta presión.',
    medicion:
      'Se mide por unidad o pieza instalada según diámetro y especificación de presión.',
    inclusiones: ['Válvula, transporte hasta el sitio de la obra y pruebas.'],
    exclusiones: ['Tuberías de conexión general que corresponden a E61.'],
    pago: {
      hito: 'Hito COVENIN (Art. 2.7): Las válvulas y llaves de paso solo se reconocen para efectos de pago una vez instaladas y probadas en la red.',
      criterio: 'Precio unitario por pieza (un) de acuerdo a su diámetro nominal y presión de trabajo.',
      inclusiones: ['Suministro de la pieza, transporte a obra y verificación de empaques y cierre hermético.'],
      condiciones: 'La instalación física está contemplada en las partidas de tuberías o puntos; esta partida remunera la pieza de alta presión.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 81',
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
    pago: {
      hito: 'Hito COVENIN: Se valúa por artefacto fijado, nivelado, sellado y conectado con funcionamiento hidráulico comprobado.',
      criterio: 'Precio unitario por unidad (un) o juego de artefacto sanitario.',
      inclusiones: ['Artefacto, herrajes internos, grifería asociada, sellos de cera, pernos de anclaje y pruebas de descarga.'],
      condiciones: 'Las tuberías de alimentación y descarga corresponden a los puntos sanitarios E62.',
    },
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
    pago: {
      hito: 'Hito COVENIN (Art. 2.13 y Cap. E9): Se valúa contra guías de volteo conformadas en el botadero autorizado o recibidas en obra.',
      criterio: 'Precio unitario por metro cúbico-kilómetro (m³·km), cubicado en estado suelto sobre camión.',
      inclusiones: ['Carga (cuando lo indique la partida), transporte en camión volteo y descarga en botadero.'],
      condiciones: 'Distancia medida por la ruta más corta y económica aprobada por la inspección. Excluyente con otras partidas de flete.',
    },
    source: 'COVENIN-MINDUR 2000-2:1999',
    pages: 'PDF 105-106',
  },
};

export function getPartidaDocumentacion(item) {
  const rawCode = String(item?.CovPar || item?.CodPar || '').trim().toUpperCase();
  const clean = rawCode.replace(/[^A-Z0-9]/g, '');
  const match = clean.match(/^([A-Z])(\d)(\d)/);
  if (!match) return null;

  const letter = match[1];
  const chapterCode = `${letter}${match[2]}`;
  const subchapterCode = `${letter}${match[2]}${match[3]}`;
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
