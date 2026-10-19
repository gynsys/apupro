// Utilidades de los árboles de decisión (extraídas de actionPipelines.js)
/**
 * Filtro para verificar si un valor fue omitido
 */
export function isOmitted(val) {
  if (!val) return true;
  const lower = val.trim().toLowerCase();
  return lower === 'omitir' || lower === 'ninguno' || lower === 'ninguno / omitir' || lower === 'sugerir por ia' || lower === 'sugerir';
}

/**
 * Normaliza y limpia una unidad de medida seleccionada
 */
export function extractCleanUnit(unitText) {
  if (!unitText || isOmitted(unitText)) return null;
  let raw = unitText.includes('(') ? unitText.split('(')[0].trim() : unitText.trim();
  if (raw === 'm²') return 'm2';
  if (raw === 'm³') return 'm3';
  return raw.toLowerCase();
}
