/**
 * Catálogo de chips paramétricos empíricos minados de las 17.343 partidas de CostBase.
 * Garantiza opciones reales de mercado con 0 alucinaciones y 0 consumo de tokens.
 */

export function getEmpiricalMaterialChips(accion = '', elemento = '') {
  const acc = (accion || '').toLowerCase();
  const elem = (elemento || '').toLowerCase();

  // 1. Pinturas y Recubrimientos
  if (/pintur|pintar|esmalte/i.test(acc)) {
    if (/losa|techo/i.test(elem)) {
      return [
        'Pintura impermeabilizante elastomérica',
        'Pintura de caucho clase A',
        'Pintura de caucho clase B',
        'Pintura reflectiva de aluminio',
        'Pintura elastomérica antihongos',
        'Pintura epóxica para losas',
        'Pintura satinada',
        'Omitir'
      ];
    }
    if (/reja|herrer|metal|porton|portón|puerta|marco|hierro|acero|tubo|tuber/i.test(elem)) {
      return [
        'Esmalte sintético alquídico',
        'Fondo anticorrosivo alquídico',
        'Fondo cromato de zinc',
        'Pintura epóxica para metal',
        'Fondo epóxico poliamida',
        'Esmalte secado rápido',
        'Poliuretano alifático',
        'Omitir'
      ];
    }
    if (/piso|pavimento|cancha/i.test(elem)) {
      return [
        'Pintura epóxica alto tráfico',
        'Pintura para tráfico / vial',
        'Poliuretano para pisos',
        'Pintura acrílica para concreto',
        'Esmalte para pisos',
        'Omitir'
      ];
    }
    return [
      'Pintura de caucho clase A',
      'Pintura de caucho clase B',
      'Esmalte sintético alquídico',
      'Fondo anticorrosivo alquídico',
      'Fondo cromato de zinc',
      'Pintura elastomérica',
      'Pintura epóxica',
      'Fondo antialcalino',
      'Omitir'
    ];
  }

  // 2. Impermeabilizaciones
  if (/impermeabiliz|manto/i.test(acc)) {
    return [
      'Manto asfáltico 3 mm',
      'Manto asfáltico 4 mm',
      'Manto con foil de aluminio',
      'Membrana líquida elastomérica',
      'Primer imprimador asfáltico',
      'Pintura reflectiva de aluminio',
      'Omitir'
    ];
  }

  // 3. Sobrepisos y Nivelaciones
  if (/sobrepiso|nivelaci[oó]n|afinado/i.test(elem) || /sobrepiso/i.test(acc)) {
    return [
      'Mortero cemento-arena 1:3 e=2.5 cm',
      'Mortero cemento-arena 1:3 e=3.0 cm',
      'Mortero cemento-arena 1:4 e=3.0 cm',
      'Mortero cemento-arena 1:3 e=4.0 cm',
      'Mortero cemento-arena 1:4 e=5.0 cm',
      "Concreto f'c=150 kg/cm² e=5.0 cm",
      'Omitir'
    ];
  }

  // 4. Paredes de Bloques y Mampostería
  if (/pared|muro|tabique|bloque|ladrillo/i.test(elem) || (/construc|coloca/i.test(acc) && /bloque/i.test(elem))) {
    return [
      'Bloque de concreto e=10 cm',
      'Bloque de concreto e=15 cm',
      'Bloque de concreto e=20 cm',
      'Bloque de arcilla e=10 cm',
      'Bloque de arcilla e=15 cm',
      'Bloque de arcilla e=20 cm',
      'Ladrillo macizo de arcilla',
      'Bloque de ventilación calado',
      'Omitir'
    ];
  }

  // 5. Losas de Concreto (Vaciado)
  if (/losa/i.test(elem) && (/vaciado|construc|coloca/i.test(acc) || !acc)) {
    return [
      "Concreto f'c=210 kg/cm² e=10 cm",
      "Concreto f'c=210 kg/cm² e=15 cm",
      "Concreto f'c=210 kg/cm² e=20 cm",
      "Concreto f'c=250 kg/cm² e=15 cm",
      "Concreto f'c=250 kg/cm² e=20 cm",
      "Concreto f'c=250 kg/cm² e=25 cm",
      "Concreto f'c=280 kg/cm² e=20 cm",
      'Omitir'
    ];
  }

  // 6. Pavimentos, Aceras y Brocales
  if (/pavimento|acera|brocal/i.test(elem) && (/vaciado|construc|coloca/i.test(acc) || !acc)) {
    return [
      "Concreto f'c=210 kg/cm² e=10 cm",
      "Concreto f'c=210 kg/cm² e=12 cm",
      "Concreto f'c=250 kg/cm² e=15 cm",
      "Concreto f'c=250 kg/cm² e=20 cm",
      "Concreto f'c=280 kg/cm² e=20 cm",
      'Omitir'
    ];
  }

  // 7. Excavaciones y Movimiento de Tierra
  if (/excavac|zanja/i.test(elem) || /excavac/i.test(acc)) {
    return [
      'Hasta 1.50 m (a mano)',
      'Hasta 1.50 m (a máquina)',
      'De 1.50 a 3.00 m (a máquina)',
      'Mayor a 3.00 m (a máquina)',
      'En zanjas hasta 1.50 m a mano',
      'Omitir'
    ];
  }

  // 8. Tuberías y Válvulas
  if (/tuber|valvul|plomer/i.test(elem)) {
    return [
      'Tubería PVC 1/2"',
      'Tubería PVC 3/4"',
      'Tubería PVC 1"',
      'Tubería PVC 2"',
      'Tubería PVC 3"',
      'Tubería PVC 4"',
      'Tubería de acero HG 1/2"',
      'Tubería de cobre 1/2"',
      'Tubería PVC 6"',
      'Válvula compuerta 1/2"',
      'Omitir'
    ];
  }

  // 9. Bombas e Hidroneumáticos
  if (/bomba|electrobomba/i.test(elem)) {
    return [
      'Potencia 0.5 HP',
      'Potencia 1 HP',
      'Potencia 1.5 HP',
      'Potencia 2 HP',
      'Potencia 3 HP',
      'Potencia 5 HP',
      'Potencia 7.5 HP',
      'Potencia 10 HP',
      'Omitir'
    ];
  }

  // 10. Concreto en Columnas, Vigas y Zapatas
  if (/concreto|columna|viga|zapata|fundacion|fundación/i.test(elem) || /vaciado/i.test(acc)) {
    return [
      "Concreto f'c=210 kg/cm²",
      "Concreto f'c=250 kg/cm²",
      "Concreto f'c=280 kg/cm²",
      "Concreto f'c=300 kg/cm²",
      "Concreto f'c=350 kg/cm²",
      "Concreto pobre f'c=150 kg/cm²",
      'Mortero 1:3 arena lavada',
      'Mortero 1:4 con cal',
      'Omitir'
    ];
  }

  // 11. Electricidad (Cables y Tableros)
  if (/cable|conductor/i.test(elem)) {
    return [
      'Calibre #14 AWG THHN',
      'Calibre #12 AWG THHN',
      'Calibre #10 AWG THHN',
      'Calibre #8 AWG THHN',
      'Calibre #6 AWG TTU',
      'Calibre #4 AWG TTU',
      'Calibre 2/0 AWG TTU',
      'Omitir'
    ];
  }

  if (/tablero/i.test(elem)) {
    return [
      '8 circuitos bifásico',
      '12 circuitos bifásico',
      '18 circuitos trifásico',
      '24 circuitos trifásico',
      '30 circuitos trifásico',
      '42 circuitos trifásico',
      'Omitir'
    ];
  }

  return null;
}

export function getEmpiricalStep3Prompt(accion = '', elemento = '') {
  const acc = (accion || '').toLowerCase();
  const elem = (elemento || '').toLowerCase();

  if (/vaciado|construc/i.test(acc) && /losa/i.test(elem)) {
    return "Defina la Resistencia y Espesor de la Losa\nSeleccione la resistencia del concreto (f'c) y el espesor de la losa:";
  }
  if (/sobrepiso/i.test(elem) || /sobrepiso/i.test(acc)) {
    return 'Defina la Dosificación y Espesor del Sobrepiso\nSeleccione la proporción del mortero y el espesor de nivelación:';
  }
  if (/excavac/i.test(acc) || /excavac|zanja/i.test(elem)) {
    return 'Defina la Profundidad y Método de Excavación\nSeleccione la profundidad estimada y método de excavación:';
  }
  if (/pintur/i.test(acc)) {
    return 'Defina el Tipo de Pintura o Acabado\nSeleccione el tipo de pintura o recubrimiento a aplicar:';
  }
  if (/impermeabiliz/i.test(acc)) {
    return 'Defina el Sistema de Impermeabilización\nSeleccione el manto o membrana impermeabilizante:';
  }
  if (/bomba/i.test(elem)) {
    return 'Defina la Potencia del Equipo\nSeleccione la potencia (HP/kW) o capacidad:';
  }
  if (/tuber|valvul/i.test(elem)) {
    return 'Defina el Diámetro y Material\nSeleccione el diámetro nominal y tipo de tubería:';
  }
  return null;
}
