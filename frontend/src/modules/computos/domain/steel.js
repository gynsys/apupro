/**
 * Módulo de Acero de Refuerzo (Cabillas y Despiece).
 * Basado en la Norma Venezolana COVENIN y estándares internacionales ASTM A615 / A706.
 */

export const REBAR_DIAMETERS = [
  { label: '3/8" (N° 3)', designation: 'N° 3', inches: '3/8"', mm: 9.5, weightKgM: 0.559 },
  { label: '1/2" (N° 4)', designation: 'N° 4', inches: '1/2"', mm: 12.7, weightKgM: 0.994 },
  { label: '5/8" (N° 5)', designation: 'N° 5', inches: '5/8"', mm: 15.9, weightKgM: 1.552 },
  { label: '3/4" (N° 6)', designation: 'N° 6', inches: '3/4"', mm: 19.1, weightKgM: 2.235 },
  { label: '7/8" (N° 7)', designation: 'N° 7', inches: '7/8"', mm: 22.2, weightKgM: 3.042 },
  { label: '1" (N° 8)', designation: 'N° 8', inches: '1"', mm: 25.4, weightKgM: 3.973 },
  { label: '1-1/8" (N° 9)', designation: 'N° 9', inches: '1-1/8"', mm: 28.7, weightKgM: 5.060 },
  { label: '1-1/4" (N° 10)', designation: 'N° 10', inches: '1-1/4"', mm: 32.3, weightKgM: 6.404 },
  { label: '1-3/8" (N° 11)', designation: 'N° 11', inches: '1-3/8"', mm: 35.8, weightKgM: 7.907 },
];

/**
 * Detecta si una fila o partida corresponde a acero de refuerzo
 */
export function isSteelRow(row) {
  if (!row) return false;
  const unit = String(row.unit || '').trim().toUpperCase();
  if (unit === 'KGF' || unit === 'KG' || unit === 'TON') return true;
  const desc = String(row.description || '').toUpperCase();
  return /\b(ACERO|CABILLA|CABILLAS|ESTRIBO|ESTRIBOS|ARMADURA|MALLA ELECTROSOLDADA)\b/.test(desc);
}

/**
 * Busca las especificaciones de una cabilla por su diámetro en pulgadas o designación
 */
export function getRebarSpec(diameterStr) {
  if (!diameterStr) return null;
  const clean = String(diameterStr).trim().toLowerCase();
  return (
    REBAR_DIAMETERS.find(
      (r) =>
        r.inches.toLowerCase() === clean ||
        r.designation.toLowerCase() === clean ||
        r.label.toLowerCase().includes(clean)
    ) || null
  );
}

/**
 * Calcula la longitud de corte en metros para un estribo rectangular
 * @param {number} colWidthCm - Ancho total de la viga o columna en cm
 * @param {number} colHeightCm - Alto total de la viga o columna en cm
 * @param {number} coverCm - Recubrimiento de concreto en cm (por defecto 2.5 cm)
 * @param {number} hookLengthCm - Longitud de cada gancho sísmico a 135° en cm (por defecto 10 cm)
 * @returns {number} Longitud de corte en metros redondeada a 2 decimales
 */
export function calculateStirrupCutLength(colWidthCm, colHeightCm, coverCm = 2.5, hookLengthCm = 10) {
  const w = Math.max(0, Number(colWidthCm || 0) - 2 * Number(coverCm || 0));
  const h = Math.max(0, Number(colHeightCm || 0) - 2 * Number(coverCm || 0));
  const perimeter = 2 * (w + h);
  const totalCm = perimeter + 2 * Number(hookLengthCm || 0);
  return Math.round((totalCm / 100) * 100) / 100;
}
