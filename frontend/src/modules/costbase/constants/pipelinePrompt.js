// Ensambla el prompt técnico y extrae la unidad (extraído de actionPipelines.js)
import { isOmitted, extractCleanUnit } from './helpers.js';

export function buildPipelinePrompt(accion, answers = {}, pipeline = []) {
  const parts = [];
  if (accion && !isOmitted(accion)) {
    parts.push(accion);
  }

  let extractedUnit = null;
  let isGlobal = false;

  for (const step of pipeline) {
    const rawVal = answers[step.id];
    if (!rawVal || isOmitted(rawVal)) continue;

    if (step.isUnit) {
      const cleanLower = rawVal.toLowerCase().trim();
      isGlobal = ['gl', 'sg', 'global', 'suma global'].includes(cleanLower) || rawVal.trim() === 'Gl' || rawVal.includes('Gl (');
      if (isGlobal) {
        extractedUnit = 'Gl';
        parts.push('unidad Gl');
      } else {
        const u = extractCleanUnit(rawVal);
        if (u) {
          extractedUnit = u;
          parts.push(`unidad ${u}`);
        }
      }
      continue;
    }

    if (typeof step.format === 'function') {
      const formatted = step.format(rawVal, answers);
      if (formatted && formatted.trim()) {
        parts.push(formatted.trim());
      }
    } else {
      parts.push(rawVal.trim());
    }
  }

  const finalPrompt = parts.join(' ').replace(/\s+/g, ' ').trim();
  return { finalPrompt, unit: extractedUnit, isGlobal };
}
