// Estados de hallazgo que se consideran resueltos para efectos del puntaje de aprobación
export const RESOLVED_FINDING_STATUSES = new Set(['CORREGIDO', 'JUSTIFICADO']);

/**
 * Puntaje de la revisión: % de partidas aprobadas sobre el total de partidas.
 * Una partida está aprobada si no tiene hallazgos vigentes (CRÍTICA/ALTA/MEDIA) sin
 * corregir ni justificar. Los hallazgos informativos (INFO_MAPREX) no cuentan y los
 * capítulos no se consideran partidas.
 *
 * @param {Array<object>} items Partidas del informe (con su lista `findings`).
 * @returns {{total:number, approved:number, observed:number, score:number, allApproved:boolean}}
 */
export function computePartidaApprovalStats(items) {
  const partidas = (items || []).filter((it) => !it.is_chapter);
  const total = partidas.length;
  const observed = partidas.filter((it) =>
    (it.findings || []).some(
      (f) =>
        f.severity !== 'INFO_MAPREX' &&
        !RESOLVED_FINDING_STATUSES.has(f.finding_status || 'PENDIENTE')
    )
  ).length;
  const approved = total - observed;
  const score = total > 0 ? Math.round((approved / total) * 1000) / 10 : 100;
  return { total, approved, observed, score, allApproved: observed === 0 };
}
