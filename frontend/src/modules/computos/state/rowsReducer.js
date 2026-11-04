/**
 * Reducer de filas de la planilla de cómputos.
 *
 * Mantiene las mismas reglas del modal actual:
 * - cada edición recalcula la fila;
 * - siempre queda una fila vacía al final;
 * - los parciales recalculan la cantidad total.
 */
import { createBlankRow, isItemEmpty, normalizeRowsWithSingleTrailingBlank } from '../domain/rows.js';
import { computePartial, recomputeItemWithPartials, recomputeRow } from '../domain/formulas.js';

function newId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createRowsState(rows = null, activeChapter = '') {
  return {
    rows: normalizeRowsWithSingleTrailingBlank(rows || [createBlankRow(activeChapter)], activeChapter),
    activeChapter,
  };
}

export function rowsReducer(state, action) {
  const { type, payload = {} } = action || {};
  const activeChapter = payload.activeChapter ?? state.activeChapter ?? '';
  const rows = state.rows;

  switch (type) {
    case 'SET_ROWS':
      return {
        ...state,
        activeChapter,
        rows: normalizeRowsWithSingleTrailingBlank(
          typeof payload.rows === 'function' ? payload.rows(rows) : payload.rows,
          activeChapter
        ),
      };

    case 'UPDATE_FIELD': {
      const updated = rows.map((row) =>
        row.id === payload.itemId ? recomputeRow(row, payload.field, payload.value) : row
      );
      return { ...state, activeChapter, rows: normalizeRowsWithSingleTrailingBlank(updated, activeChapter) };
    }

    case 'DUPLICATE_ROW': {
      const duplicated = { ...payload.item, id: newId('item') };
      const nonBlank = rows.filter((row) => !isItemEmpty(row));
      return {
        ...state,
        activeChapter,
        rows: normalizeRowsWithSingleTrailingBlank([...nonBlank, duplicated], activeChapter),
      };
    }

    case 'INSERT_ROW_BELOW': {
      const newRow = createBlankRow(payload.targetItem?.chapter || activeChapter);
      const targetIdx = rows.findIndex((row) => row.id === payload.targetItem?.id);
      if (targetIdx === -1) {
        return { ...state, activeChapter, rows: normalizeRowsWithSingleTrailingBlank([...rows, newRow], activeChapter) };
      }
      const updated = [...rows];
      updated.splice(targetIdx + 1, 0, newRow);
      return { ...state, activeChapter, rows: normalizeRowsWithSingleTrailingBlank(updated, activeChapter) };
    }

    case 'REMOVE_ROW': {
      const filtered = rows.filter((row) => row.id !== payload.itemId);
      return { ...state, activeChapter, rows: normalizeRowsWithSingleTrailingBlank(filtered, activeChapter) };
    }

    case 'TOGGLE_PARTIALS': {
      const updated = rows.map((row) => {
        if (row.id !== payload.itemId) return row;
        if (row.partials && row.partials.length > 0) return row;
        const first = {
          id: newId('part'),
          description: 'Parcial 1',
          times: row.times || 1,
          length: row.length || '',
          width: row.width || '',
          height: row.height || '',
          factor: row.factor || '',
          distance: row.distance || '',
          m3: row.m3 || '',
          partial: row.partial || 0,
          observations: '',
        };
        const second = {
          id: newId('part'),
          description: 'Parcial 2',
          times: 1,
          length: '',
          width: '',
          height: '',
          factor: '',
          distance: '',
          m3: '',
          partial: 0,
          observations: '',
        };
        first.partial = computePartial(first);
        return recomputeItemWithPartials({ ...row, partials: [first, second] });
      });
      return { ...state, activeChapter, rows: updated };
    }

    case 'CLEAR_PARTIALS': {
      const updated = rows.map((row) =>
        row.id === payload.itemId ? { ...row, partials: null } : row
      );
      return { ...state, activeChapter, rows: updated };
    }

    case 'ADD_PARTIAL': {
      const updated = rows.map((row) => {
        if (row.id !== payload.itemId) return row;
        const currentList = row.partials || [];
        const nextNum = currentList.length + 1;
        const partial = {
          id: newId('part'),
          description: `Parcial ${nextNum}`,
          times: 1,
          length: '',
          width: '',
          height: '',
          factor: '',
          distance: '',
          m3: '',
          partial: 0,
          observations: '',
        };
        return recomputeItemWithPartials({ ...row, partials: [...currentList, partial] });
      });
      return { ...state, activeChapter, rows: updated };
    }

    case 'UPDATE_PARTIAL_FIELD': {
      const updated = rows.map((row) => {
        if (row.id !== payload.itemId || !row.partials) return row;
        const partials = row.partials.map((partial) => {
          if (partial.id !== payload.partialId) return partial;
          const next = { ...partial, [payload.field]: payload.value };
          if (payload.field === 'm3') {
            next.m3 = payload.value;
            next._autoM3 = null;
          }
          next.partial = computePartial(next);
          return next;
        });
        return recomputeItemWithPartials({ ...row, partials });
      });
      return { ...state, activeChapter, rows: updated };
    }

    case 'REMOVE_PARTIAL': {
      const updated = rows.map((row) => {
        if (row.id !== payload.itemId || !row.partials) return row;
        const filtered = row.partials.filter((partial) => partial.id !== payload.partialId);
        if (filtered.length === 0) return { ...row, partials: null };
        return recomputeItemWithPartials({ ...row, partials: filtered });
      });
      return { ...state, activeChapter, rows: updated };
    }

    default:
      return state;
  }
}
