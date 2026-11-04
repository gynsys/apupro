import { describe, it, expect } from 'vitest';
import { createRowsState, rowsReducer } from '../rowsReducer.js';
import { selectFilteredRows, selectTotals, selectValidRows } from '../selectors.js';
import { createBlankRow, isItemEmpty } from '../../domain/rows.js';

function stateWithRows(rows) {
  return createRowsState(rows, 'GENERAL');
}

describe('rowsReducer', () => {
  it('inicializa con una fila vacía', () => {
    const state = createRowsState([], 'GENERAL');
    expect(state.rows).toHaveLength(1);
    expect(isItemEmpty(state.rows[0])).toBe(true);
  });

  it('actualiza un campo y recalcula la cantidad', () => {
    const row = { ...createBlankRow('GENERAL'), id: 'r1' };
    const state = stateWithRows([row]);
    const withLength = rowsReducer(state, {
      type: 'UPDATE_FIELD',
      payload: { itemId: 'r1', field: 'length', value: '2', activeChapter: 'GENERAL' },
    });
    const withWidth = rowsReducer(withLength, {
      type: 'UPDATE_FIELD',
      payload: { itemId: 'r1', field: 'width', value: '3', activeChapter: 'GENERAL' },
    });
    expect(withWidth.rows[0].quantity).toBe(6);
    expect(withWidth.rows.some(isItemEmpty)).toBe(true);
  });

  it('duplica una fila y conserva una fila vacía final', () => {
    const row = { ...createBlankRow('GENERAL'), id: 'r1', description: 'Pared', quantity: 10 };
    const state = rowsReducer(stateWithRows([row]), {
      type: 'DUPLICATE_ROW',
      payload: { item: row, activeChapter: 'GENERAL' },
    });
    expect(state.rows.filter((r) => !isItemEmpty(r))).toHaveLength(2);
    expect(isItemEmpty(state.rows[state.rows.length - 1])).toBe(true);
  });

  it('inserta una fila debajo', () => {
    const row = { ...createBlankRow('GENERAL'), id: 'r1', description: 'Pared' };
    const state = rowsReducer(stateWithRows([row]), {
      type: 'INSERT_ROW_BELOW',
      payload: { targetItem: row, activeChapter: 'GENERAL' },
    });
    expect(state.rows[0].id).toBe('r1');
    expect(isItemEmpty(state.rows[1])).toBe(true);
  });

  it('elimina una fila y deja una vacía', () => {
    const row = { ...createBlankRow('GENERAL'), id: 'r1', description: 'Pared' };
    const state = rowsReducer(stateWithRows([row]), {
      type: 'REMOVE_ROW',
      payload: { itemId: 'r1', activeChapter: 'GENERAL' },
    });
    expect(state.rows).toHaveLength(1);
    expect(isItemEmpty(state.rows[0])).toBe(true);
  });

  it('activa y elimina parciales', () => {
    const row = { ...createBlankRow('GENERAL'), id: 'r1', description: 'Pared', partial: 4 };
    const state = rowsReducer(stateWithRows([row]), {
      type: 'TOGGLE_PARTIALS',
      payload: { itemId: 'r1', activeChapter: 'GENERAL' },
    });
    expect(state.rows[0].partials).toHaveLength(2);

    const added = rowsReducer(state, {
      type: 'ADD_PARTIAL',
      payload: { itemId: 'r1', activeChapter: 'GENERAL' },
    });
    expect(added.rows[0].partials).toHaveLength(3);

    const removed = rowsReducer(added, {
      type: 'REMOVE_PARTIAL',
      payload: { itemId: 'r1', partialId: added.rows[0].partials[0].id, activeChapter: 'GENERAL' },
    });
    expect(removed.rows[0].partials).toHaveLength(2);

    const cleared = rowsReducer(removed, {
      type: 'CLEAR_PARTIALS',
      payload: { itemId: 'r1', activeChapter: 'GENERAL' },
    });
    expect(cleared.rows[0].partials).toBeNull();
  });
});

describe('selectores de filas', () => {
  const rows = [
    { ...createBlankRow('GENERAL'), id: '1', description: 'Pared de bloque', quantity: 10 },
    { ...createBlankRow('GENERAL'), id: '2', description: 'Tubería', quantity: 5 },
    createBlankRow('GENERAL'),
  ];

  it('separa filas válidas de la fila vacía', () => {
    expect(selectValidRows(rows)).toHaveLength(2);
  });

  it('filtra por descripción sin perder índices originales', () => {
    const filtered = selectFilteredRows(rows, 'pared');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
    expect(filtered[0].originalIndex).toBe(0);
  });

  it('calcula totales sin contar la fila vacía', () => {
    expect(selectTotals(rows)).toEqual({ items: 2, quantity: 15 });
  });
});
