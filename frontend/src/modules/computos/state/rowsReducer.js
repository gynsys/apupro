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
import { applyReactiveLinks, computeLinkedQuantity } from '../domain/links.js';

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
      const withLinks = applyReactiveLinks(updated);
      return { ...state, activeChapter, rows: normalizeRowsWithSingleTrailingBlank(withLinks, activeChapter) };
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
      const withLinks = applyReactiveLinks(filtered);
      return { ...state, activeChapter, rows: normalizeRowsWithSingleTrailingBlank(withLinks, activeChapter) };
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
      const withLinks = applyReactiveLinks(updated);
      return { ...state, activeChapter, rows: withLinks };
    }

    case 'REMOVE_PARTIAL': {
      const updated = rows.map((row) => {
        if (row.id !== payload.itemId || !row.partials) return row;
        const filtered = row.partials.filter((partial) => partial.id !== payload.partialId);
        if (filtered.length === 0) return { ...row, partials: null };
        return recomputeItemWithPartials({ ...row, partials: filtered });
      });
      const withLinks = applyReactiveLinks(updated);
      return { ...state, activeChapter, rows: withLinks };
    }

    case 'LINK_ROWS': {
      const source = rows.find((r) => r.id === payload.sourceItemId);
      if (!source) return state;

      const calculatedQty = computeLinkedQuantity(source.quantity, payload.linkConfig);

      if (payload.isNewRow) {
        const newRow = {
          ...createBlankRow(payload.newRowData?.chapter || activeChapter),
          id: newId('item'),
          chapter: payload.newRowData?.chapter || source.chapter || activeChapter,
          description: (payload.newRowData?.description || 'PARTIDA VINCULADA').toUpperCase(),
          unit: payload.newRowData?.unit || 'M2',
          quantity: calculatedQty,
          partial: calculatedQty,
          distance: payload.linkConfig?.distance || '',
          factor: payload.linkConfig?.factor || '',
          observations: `Medición vinculada a: ${source.description || 'Ítem origen'}`,
          linkedTo: {
            sourceItemId: source.id,
            sourceDescription: source.description || '',
            formulaType: payload.linkConfig?.formulaType || 'custom',
            factor: payload.linkConfig?.factor || 1,
            distance: payload.linkConfig?.distance || null,
            label: payload.linkConfig?.label || `Vinculado a: ${source.description || 'Ítem origen'}`,
          },
        };
        const nonBlank = rows.filter((r) => !isItemEmpty(r));
        return {
          ...state,
          activeChapter,
          rows: normalizeRowsWithSingleTrailingBlank([...nonBlank, newRow], activeChapter),
        };
      }

      // Vincular a partida existente
      const updated = rows.map((r) => {
        if (r.id !== payload.targetItemId) return r;
        return {
          ...r,
          quantity: calculatedQty,
          partial: calculatedQty,
          distance: payload.linkConfig?.distance || r.distance || '',
          linkedTo: {
            sourceItemId: source.id,
            sourceDescription: source.description || '',
            formulaType: payload.linkConfig?.formulaType || 'custom',
            factor: payload.linkConfig?.factor || 1,
            distance: payload.linkConfig?.distance || null,
            label: payload.linkConfig?.label || `Vinculado a: ${source.description || 'Ítem origen'}`,
          },
        };
      });
      return { ...state, activeChapter, rows: updated };
    }

    case 'UNLINK_ROW': {
      const updated = rows.map((r) => {
        if (r.id !== payload.itemId) return r;
        return { ...r, linkedTo: null };
      });
      return { ...state, activeChapter, rows: updated };
    }

    default:
      return state;
  }
}
