/**
 * Reducer de filas de la planilla de cómputos.
 *
 * Mantiene las mismas reglas del modal actual:
 * - cada edición recalcula la fila;
 * - siempre queda una fila vacía al final;
 * - los parciales recalculan la cantidad total.
 */
import { createBlankRow, isItemEmpty, normalizeRowsWithSingleTrailingBlank } from '../domain/rows.js';
import { computePartial, recomputeItemWithPartials, recomputeRow, round2 } from '../domain/formulas.js';
import { applyReactiveLinks, computeLinkedQuantity, getRowOwnQuantity } from '../domain/links.js';
import { getRebarSpec } from '../domain/steel.js';

function newId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const MAX_HISTORY_STEPS = 30;

function cloneRowsSnapshot(rows) {
  try {
    return JSON.parse(JSON.stringify(rows || []));
  } catch (_e) {
    return Array.isArray(rows) ? [...rows] : [];
  }
}

export function createRowsState(rows = null, activeChapter = '') {
  return {
    rows: normalizeRowsWithSingleTrailingBlank(rows || [createBlankRow(activeChapter)], activeChapter),
    activeChapter,
    history: [],
    future: [],
    _lastHistoryMeta: null,
  };
}

function rowsReducerCore(state, action) {
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

    case 'ADD_ROWS': {
      const incoming = Array.isArray(payload.rows) ? payload.rows : [];
      const base = rows.filter((row, index) => !(index === rows.length - 1 && isItemEmpty(row)));
      return {
        ...state,
        activeChapter,
        rows: normalizeRowsWithSingleTrailingBlank([...base, ...incoming], activeChapter),
      };
    }

    case 'REPLACE_MACRO_ROWS': {
      const incoming = Array.isArray(payload.rows) ? payload.rows : [];
      const base = rows.filter(
        (row, index) => !(index === rows.length - 1 && isItemEmpty(row)) && row.macro_instance_id !== payload.instanceId
      );
      return {
        ...state,
        activeChapter,
        rows: normalizeRowsWithSingleTrailingBlank([...base, ...incoming], activeChapter),
      };
    }

    case 'UPDATE_FIELD': {
      const updated = rows.map((row) => {
        if (row.id !== payload.itemId) return row;
        // Si la fila tiene parciales y se actualiza una dimensión física en la fila padre,
        // sincronizar el primer parcial propio (no vinculado) antes de recalcular
        if (
          Array.isArray(row.partials) &&
          row.partials.length > 0 &&
          ['length', 'width', 'height', 'times', 'factor', 'distance'].includes(payload.field)
        ) {
          const firstOwnIdx = row.partials.findIndex((p) => !p?.linkedTo);
          if (firstOwnIdx !== -1) {
            const nextPartials = row.partials.map((p, idx) => {
              if (idx !== firstOwnIdx) return p;
              const nextP = { ...p, [payload.field]: payload.value };
              nextP.partial = computePartial(nextP, row.unit);
              return nextP;
            });
            return recomputeItemWithPartials({ ...row, partials: nextPartials });
          }
        }
        return recomputeRow(row, payload.field, payload.value);
      });
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
      const withLinks = applyReactiveLinks(updated);
      return { ...state, activeChapter, rows: withLinks };
    }

    case 'CLEAR_PARTIALS': {
      const updated = rows.map((row) =>
        row.id === payload.itemId ? recomputeRow({ ...row, partials: null }, '_clearPartials', null) : row
      );
      const withLinks = applyReactiveLinks(updated);
      return { ...state, activeChapter, rows: withLinks };
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
      const withLinks = applyReactiveLinks(updated);
      return { ...state, activeChapter, rows: withLinks };
    }

    case 'UPDATE_PARTIAL_FIELD': {
      const updated = rows.map((row) => {
        if (row.id !== payload.itemId || !row.partials) return row;
        const partials = row.partials.map((partial) => {
          if (partial.id !== payload.partialId) return partial;
          const next = { ...partial, [payload.field]: payload.value };
          if (payload.field === 'rebarDiameter') {
            const spec = getRebarSpec(payload.value);
            if (spec) {
              next.factor = spec.weightKgM;
            }
          }
          if (payload.field === 'm3') {
            next.m3 = payload.value;
            next._autoM3 = null;
          }
          next.partial = computePartial(next, row.unit);
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
          _ownQuantity: 0,
          _ownFormula: '',
          distance: payload.linkConfig?.distance || '',
          factor: payload.linkConfig?.factor || '',
          observations: `Medición vinculada a: ${source.description || 'Ítem origen'}`,
          linkedTo: {
            sourceItemId: source.id,
            sourceDescription: source.description || '',
            formulaType: payload.linkConfig?.formulaType || 'custom',
            factor: payload.linkConfig?.factor || 1,
            distance: payload.linkConfig?.distance || null,
            mode: 'replace',
            baseQuantity: 0,
            baseFormula: '',
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

      // Vincular a partida existente: NUNCA sustituye nada, agrega un parcial nuevo
      // con la descripción "Viene de [partida origen]"
      const updated = rows.map((r) => {
        if (r.id !== payload.targetItemId) return r;

        let existingPartials = [];
        if (Array.isArray(r.partials) && r.partials.length > 0) {
          existingPartials = [...r.partials];
        } else {
          const hasOwnData =
            Number(r.quantity) > 0 ||
            Number(r.partial) > 0 ||
            Boolean(r.length) ||
            Boolean(r.width) ||
            Boolean(r.height) ||
            Boolean(r.m3);

          if (hasOwnData) {
            const firstOwn = {
              id: newId('part'),
              description: 'Parcial 1',
              times: r.times || 1,
              length: r.length || '',
              width: r.width || '',
              height: r.height || '',
              factor: r.factor || '',
              distance: r.distance || '',
              m3: r.m3 || '',
              geometryType: r.geometryType || undefined,
              rebarDiameter: r.rebarDiameter || undefined,
              partial: Number(r.quantity || r.partial || 0),
              observations: r.observations || '',
            };
            firstOwn.partial = computePartial(firstOwn, r.unit);
            existingPartials = [firstOwn];
          }
        }

        const factorNum = Number(payload.linkConfig?.factor || 1);
        const distNum = payload.linkConfig?.distance ? Number(payload.linkConfig.distance) : null;
        const sourceDesc = (source.description || 'partida vinculada').trim();

        const linkedPartial = {
          id: newId('part'),
          description: `Viene de ${sourceDesc}`,
          times: 1,
          length: '',
          width: '',
          height: '',
          factor: factorNum !== 1 ? factorNum : '',
          distance: distNum || '',
          m3: '',
          partial: calculatedQty,
          observations: '',
          linkedTo: {
            sourceItemId: source.id,
            sourceDescription: sourceDesc,
            sourceQuantity: Number(source.quantity || 0),
            sourceUnit: source.unit || '',
            formulaType: payload.linkConfig?.formulaType || 'custom',
            factor: factorNum,
            distance: distNum,
          },
        };
        linkedPartial.partial = computePartial(linkedPartial, r.unit);

        return recomputeItemWithPartials({
          ...r,
          partials: [...existingPartials, linkedPartial],
        });
      });
      const withLinks = applyReactiveLinks(updated);
      return { ...state, activeChapter, rows: withLinks };
    }

    case 'UNLINK_ROW': {
      const updated = rows.map((r) => {
        if (r.id !== payload.itemId) return r;
        // Si tiene parciales vinculados, eliminar los parciales que provienen de vínculo
        if (Array.isArray(r.partials) && r.partials.some((p) => p?.linkedTo)) {
          const remaining = r.partials.filter((p) => !p?.linkedTo);
          if (remaining.length === 0) {
            return { ...r, partials: null, quantity: 0, partial: 0, formula: '', linkedTo: null };
          }
          return recomputeItemWithPartials({ ...r, partials: remaining, linkedTo: null });
        }
        const ownQty = getRowOwnQuantity(r);
        const ownFormula = r._ownFormula ?? r.linkedTo?.baseFormula ?? '';
        const restoredQty = r.linkedTo?.mode === 'add' ? ownQty : (ownQty > 0 ? ownQty : r.quantity);
        return {
          ...r,
          quantity: restoredQty,
          partial: restoredQty,
          formula: ownFormula,
          linkedTo: null,
        };
      });
      const withLinks = applyReactiveLinks(updated);
      return { ...state, activeChapter, rows: withLinks };
    }

    default:
      return state;
  }
}

export function rowsReducer(state, action) {
  const { type, payload = {} } = action || {};

  if (type === 'UNDO') {
    const history = state.history || [];
    if (history.length === 0) return state;
    const previousRows = history[history.length - 1];
    const nextHistory = history.slice(0, -1);
    const nextFuture = [cloneRowsSnapshot(state.rows), ...(state.future || [])].slice(0, MAX_HISTORY_STEPS);
    return {
      ...state,
      rows: previousRows,
      history: nextHistory,
      future: nextFuture,
      _lastHistoryMeta: null,
    };
  }

  if (type === 'REDO') {
    const future = state.future || [];
    if (future.length === 0) return state;
    const nextRows = future[0];
    const nextFuture = future.slice(1);
    const nextHistory = [...(state.history || []), cloneRowsSnapshot(state.rows)].slice(-MAX_HISTORY_STEPS);
    return {
      ...state,
      rows: nextRows,
      history: nextHistory,
      future: nextFuture,
      _lastHistoryMeta: null,
    };
  }

  const nextState = rowsReducerCore(state, action);
  if (nextState === state || nextState.rows === state.rows || payload.skipHistory) {
    return nextState;
  }

  // Agrupar tecleo continuo en descripción u observaciones para que Deshacer revierta palabras completas
  const now = Date.now();
  const isTextTyping =
    type === 'UPDATE_FIELD' &&
    (payload.field === 'description' || payload.field === 'observations');
  const prevMeta = state._lastHistoryMeta;
  const shouldMergeWithLastStep =
    isTextTyping &&
    prevMeta &&
    prevMeta.type === type &&
    prevMeta.itemId === payload.itemId &&
    prevMeta.field === payload.field &&
    now - prevMeta.timestamp < 1500;

  const currentHistory = state.history || [];
  const nextHistory = shouldMergeWithLastStep
    ? currentHistory
    : [...currentHistory, cloneRowsSnapshot(state.rows)].slice(-MAX_HISTORY_STEPS);

  return {
    ...nextState,
    history: nextHistory,
    future: [],
    _lastHistoryMeta: {
      type,
      itemId: payload.itemId || null,
      field: payload.field || null,
      timestamp: now,
    },
  };
}
