/** Selectores derivados de la planilla de cómputos. */
import { isItemEmpty } from '../domain/rows.js';

export function selectValidRows(rows) {
  return rows.filter((row) => !isItemEmpty(row));
}

export function selectRowsWithOriginalIndex(rows) {
  return rows.map((row, index) => ({ ...row, originalIndex: index }));
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function selectFilteredRows(rows, filter) {
  const query = normalizeText(filter).trim();
  if (!query) return selectRowsWithOriginalIndex(rows);

  return selectRowsWithOriginalIndex(rows).filter((row) => {
    if (normalizeText(row.description).includes(query)) return true;
    if (normalizeText(row.cod_par).includes(query)) return true;
    if (normalizeText(row.observations).includes(query)) return true;
    return (row.partials || []).some(
      (partial) =>
        normalizeText(partial.description).includes(query) ||
        normalizeText(partial.observations).includes(query)
    );
  });
}

export function selectTotals(rows) {
  return rows.reduce(
    (acc, row) => {
      if (isItemEmpty(row)) return acc;
      acc.items += 1;
      acc.quantity += Number(row.quantity) || 0;
      return acc;
    },
    { items: 0, quantity: 0 }
  );
}
