/**
 * Unidades, alias y normalización de la planilla de cómputos.
 * Extraído de BudgetFromComputosModal para pruebas y reutilización.
 */

const COMMON_UNITS = [
  'M2',
  'M3',
  'ML',
  'UND',
  'PTO',
  'KGF',
  'TON',
  'M3-KM',
  'M3-M',
  'TON-KM',
  'VIAJE',
  'FLETE',
  'GL',
  'HA',
];

const UNIT_PATTERN =
  '(?:m3[\\s*xX×.\\-/]km|m³[\\s*xX×.\\-/]km|m3km|m³km|m3[\\s*xX×.\\-/]m|m³[\\s*xX×.\\-/]m|m3m|m³m|m3x50|ton[\\s*xX×.\\-/]km|tonkm|tf[\\s*xX×.\\-/]km|tfkm|kgf?[\\s*xX×.\\-/]km|kgf?[\\s*xX×.\\-/]m|viajes?|vje|fletes?|flt|gand(?:olas?)?|m2|m²|mt2|mts2|m3|m³|mt3|mts3|ml|mts|mt|m|metro|metros|und|unid|unidad|unidades|pza|pieza|piezas|pto|ptos|punto|puntos|kgf|kg|kilos|ton|tn|gl|global|sg|ha|km|lt|l)';

const UNIT_ALIASES = {
  // Acarreo y transporte
  'm3*km': 'M3-KM',
  'm3-km': 'M3-KM',
  'm3xkm': 'M3-KM',
  'm3.km': 'M3-KM',
  'm3/km': 'M3-KM',
  'm3 km': 'M3-KM',
  m3km: 'M3-KM',
  'm³*km': 'M3-KM',
  'm³-km': 'M3-KM',
  'm³xkm': 'M3-KM',
  'm³km': 'M3-KM',
  'm3*m': 'M3-M',
  'm3-m': 'M3-M',
  'm3xm': 'M3-M',
  'm3.m': 'M3-M',
  'm3/m': 'M3-M',
  'm3 m': 'M3-M',
  m3m: 'M3-M',
  m3x50: 'M3X50',
  'ton*km': 'TON-KM',
  'ton-km': 'TON-KM',
  'tonxkm': 'TON-KM',
  'ton/km': 'TON-KM',
  'ton.km': 'TON-KM',
  tonkm: 'TON-KM',
  'tf*km': 'TON-KM',
  'tf-km': 'TON-KM',
  'tfxkm': 'TON-KM',
  'tf.km': 'TON-KM',
  tfkm: 'TON-KM',
  'kgf*km': 'KGF-KM',
  'kgf-km': 'KGF-KM',
  'kg*km': 'KGF-KM',
  'kg-km': 'KGF-KM',
  'kgxkm': 'KGF-KM',
  'kgf*m': 'KGF-M',
  'kgf-m': 'KGF-M',
  'kg*m': 'KGF-M',
  'kg-m': 'KGF-M',
  viaje: 'VIAJE',
  viajes: 'VIAJE',
  vje: 'VIAJE',
  flete: 'FLETE',
  fletes: 'FLETE',
  flt: 'FLETE',
  gand: 'GAND',
  gandola: 'GAND',
  gandolas: 'GAND',

  // Unidades estándar
  m2: 'M2',
  'm²': 'M2',
  mt2: 'M2',
  mts2: 'M2',
  m3: 'M3',
  'm³': 'M3',
  mt3: 'M3',
  mts3: 'M3',
  ml: 'ML',
  m: 'ML',
  mt: 'ML',
  mts: 'ML',
  metro: 'ML',
  metros: 'ML',
  und: 'UND',
  unid: 'UND',
  unidad: 'UND',
  pza: 'UND',
  pieza: 'UND',
  pto: 'PTO',
  punto: 'PTO',
  kg: 'KGF',
  kgf: 'KGF',
  kilo: 'KGF',
  ton: 'TON',
  tn: 'TON',
  gl: 'GL',
  global: 'GL',
  sg: 'SG',
  ha: 'HA',
  km: 'KM',
  lt: 'LT',
  l: 'LT',
};

function normalizeUnitStr(u) {
  if (!u || typeof u !== 'string') return null;
  const key = u.trim().toLowerCase();
  const cleanDash = key.replace(/[\s.\-xX×/]+/g, '-');
  const cleanStar = key.replace(/[\s.\-xX×/]+/g, '*');
  return (
    UNIT_ALIASES[key] ||
    UNIT_ALIASES[cleanDash] ||
    UNIT_ALIASES[cleanStar] ||
    u.trim().toUpperCase()
  );
}

function inferUnitFromDescription(desc = '') {
  const d = (desc || '').toLowerCase();
  if (/acarreo|transporte|flete|viaje|botadero|bote.*escombro/i.test(d)) {
    if (/km|kil[oó]metro|distancia/i.test(d)) return 'M3-KM';
    if (/ton|acero|metal|estructura/i.test(d)) return 'TON-KM';
    if (/viaje|camion|volteo|gandola/i.test(d)) return 'VIAJE';
    if (/50m|primeros 50|m3xm|m3-m/i.test(d)) return 'M3-M';
    return 'M3-KM';
  }
  if (/acero|cabilla|malla|refuerzo|hierro/i.test(d)) {
    return 'KGF';
  }
  if (
    /losa|piso|techo|manto|impermeab|pared|friso|pintura|ceramica|porcelanato|muro|tabique|cielorraso|drywall|bloque|sobrepiso|acera|esmalte|epoxi/i.test(
      d
    )
  ) {
    return 'M2';
  }
  if (
    /concreto|vaciado|bote|escombro|excavaci[oó]n|relleno|viga|columna|zapata|pedestal|mortero/i.test(
      d
    )
  ) {
    return 'M3';
  }
  if (
    /tuber[ií]a|tubo|cable|canal|rodapi[eé]|costanera|viga corona|conducto/i.test(
      d
    )
  ) {
    return 'ML';
  }
  if (
    /punto|pto|toma|l[aá]mpara|interruptor|grifer[ií]a|lavamanos|poceta|inodoro|tomacorriente/i.test(
      d
    )
  ) {
    return 'PTO';
  }
  return 'UND';
}

/**
 * Evalúa de forma segura una expresión de mediciones y extrae sus factores (Largo, Ancho, Alto, Veces).
 */

export function isDiscreteUnit(unit) {
  if (!unit) return false;
  const u = String(unit).trim().toUpperCase();
  return [
    'PTO', 'PTOS', 'PUNTO', 'PUNTOS',
    'UND', 'UNID', 'UNIDAD', 'UNIDADES',
    'PZA', 'PIEZA', 'PIEZAS',
    'GL', 'GLOBAL', 'SG',
    'VIAJE', 'VIAJES',
    'FLETE', 'FLETES',
    'GAND', 'GANDOLA', 'GANDOLAS',
    'PAR', 'PARES',
    'MES', 'MESES',
    'DIA', 'DIAS', 'DÍAS',
    'HORA', 'HORAS',
    'JGO', 'JUEGO', 'JUEGOS',
    'LOTE', 'LOTES'
  ].includes(u);
}

export {
  COMMON_UNITS,
  UNIT_PATTERN,
  UNIT_ALIASES,
  normalizeUnitStr,
  inferUnitFromDescription,
};
