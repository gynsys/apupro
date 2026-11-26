const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

/**
 * Consolida el historial de movimientos (entries) en una sola fila por partida
 * con columnas dinámicas por cada fecha de avance y una columna de total acumulado.
 *
 * @param {Array} items Lista ordenada de partidas del presupuesto.
 * @param {Array} entries Historial de registros de avance.
 * @returns {{ dates: string[], rows: Array }}
 */
export function buildAvancesMatrix(items = [], entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { dates: [], rows: [] };
  }

  const dateSet = new Set();
  const byItem = new Map();

  entries.forEach((entry) => {
    if (!entry || !entry.item_id) return;
    const d = entry.entry_date || '';
    if (d) dateSet.add(d);

    const signed =
      entry.entry_type === 'reversal'
        ? -Number(entry.quantity || 0)
        : Number(entry.quantity || 0);

    if (!byItem.has(entry.item_id)) {
      byItem.set(entry.item_id, {
        item_id: entry.item_id,
        code: entry.code || '',
        description: entry.description || '',
        unit: '',
        byDate: {},
        entriesByDate: {},
        total: 0,
      });
    }

    const acc = byItem.get(entry.item_id);
    acc.byDate[d] = round2((acc.byDate[d] || 0) + signed);
    acc.total = round2(acc.total + signed);
    if (!acc.entriesByDate[d]) {
      acc.entriesByDate[d] = entry;
    }
  });

  const dates = Array.from(dateSet).sort();
  const rows = [];
  const seenItemIds = new Set();

  items.forEach((it, idx) => {
    const acc = byItem.get(it.item_id);
    if (!acc) return;
    seenItemIds.add(it.item_id);
    rows.push({
      ...acc,
      itemNumber: idx + 1,
      code: it.code || acc.code,
      description: it.description || acc.description,
      unit: it.unit || '',
    });
  });

  byItem.forEach((acc, itemId) => {
    if (!seenItemIds.has(itemId)) {
      rows.push({
        ...acc,
        itemNumber: '—',
      });
    }
  });

  return { dates, rows };
}
