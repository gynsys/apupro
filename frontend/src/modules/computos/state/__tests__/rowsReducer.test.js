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

  it('agrega filas de una macro actividad antes de la fila vacía final', () => {
    const existing = { ...createBlankRow('GENERAL'), id: 'r1', description: 'Partida existente' };
    const macro = { ...createBlankRow('PARED PERIMETRAL'), id: 'm1', description: 'Pared perimetral', quantity: 54 };
    const state = rowsReducer(stateWithRows([existing]), {
      type: 'ADD_ROWS',
      payload: { rows: [macro], activeChapter: 'GENERAL' },
    });
    expect(state.rows.filter((r) => !isItemEmpty(r))).toHaveLength(2);
    expect(state.rows[0].id).toBe('r1');
    expect(state.rows[1].id).toBe('m1');
    expect(isItemEmpty(state.rows[state.rows.length - 1])).toBe(true);
  });

  it('reemplaza las filas de una macro instancia al editarla', () => {
    const other = { ...createBlankRow('GENERAL'), id: 'other', description: 'Otra partida' };
    const oldMacro = { ...createBlankRow('PARED PERIMETRAL'), id: 'old', description: 'Pared vieja', macro_instance_id: 'macro-1' };
    const newMacro = { ...createBlankRow('PARED PERIMETRAL'), id: 'new', description: 'Pared nueva', macro_instance_id: 'macro-1' };
    const state = rowsReducer(stateWithRows([other, oldMacro]), {
      type: 'REPLACE_MACRO_ROWS',
      payload: { instanceId: 'macro-1', rows: [newMacro], activeChapter: 'GENERAL' },
    });
    expect(state.rows.some((r) => r.id === 'old')).toBe(false);
    expect(state.rows.some((r) => r.id === 'new')).toBe(true);
    expect(state.rows.some((r) => r.id === 'other')).toBe(true);
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

  it('vincula una nueva partida derivada (efecto cascada) y actualiza reactivamente', () => {
    const sourceRow = {
      ...createBlankRow('GENERAL'),
      id: 'excavacion',
      description: 'EXCAVACION EN TIERRA',
      quantity: 10,
      unit: 'M3',
    };
    const state = stateWithRows([sourceRow]);

    // Vincular partida derivada de Bote (esponjamiento 1.25)
    const linkedState = rowsReducer(state, {
      type: 'LINK_ROWS',
      payload: {
        sourceItemId: 'excavacion',
        isNewRow: true,
        newRowData: {
          description: 'TRANSPORTE Y BOTE DE TIERRA',
          unit: 'M3',
          chapter: 'GENERAL',
        },
        linkConfig: {
          formulaType: 'bote_esponjamiento',
          factor: 1.25,
          distance: 5,
          label: 'Bote de escombros (x1.25 x 5km)',
        },
      },
    });

    const boteRow = linkedState.rows.find((r) => r.description.includes('TRANSPORTE Y BOTE'));
    expect(boteRow).toBeDefined();
    // 10 * 1.25 * 5 = 62.5
    expect(boteRow.quantity).toBe(62.5);
    expect(boteRow.linkedTo.sourceItemId).toBe('excavacion');

    // Ahora cambiamos la cantidad de excavacion a 20 (UPDATE_FIELD)
    const cascadedState = rowsReducer(linkedState, {
      type: 'UPDATE_FIELD',
      payload: {
        itemId: 'excavacion',
        field: 'quantity',
        value: '20',
        activeChapter: 'GENERAL',
      },
    });

    const updatedBote = cascadedState.rows.find((r) => r.id === boteRow.id);
    // 20 * 1.25 * 5 = 125
    expect(updatedBote.quantity).toBe(125);

    // Romper vínculo con UNLINK_ROW
    const unlinkedState = rowsReducer(cascadedState, {
      type: 'UNLINK_ROW',
      payload: { itemId: boteRow.id },
    });
    const severedBote = unlinkedState.rows.find((r) => r.id === boteRow.id);
    expect(severedBote.linkedTo).toBeNull();

    // Modificar excavacion a 30 no debe afectar al bote desvinculado
    const afterSeverState = rowsReducer(unlinkedState, {
      type: 'UPDATE_FIELD',
      payload: {
        itemId: 'excavacion',
        field: 'quantity',
        value: '30',
        activeChapter: 'GENERAL',
      },
    });
    const finalBote = afterSeverState.rows.find((r) => r.id === boteRow.id);
    expect(finalBote.quantity).toBe(125);
  });

  it('suma las mediciones al vincular dos partidas existentes (ej: Remoción de rejas 5 M2 + Remoción de ventana 50 M2 = 55 M2)', () => {
    const rejasRow = {
      ...createBlankRow('GENERAL'),
      id: 'remocion-rejas',
      description: 'REMOCION DE REJAS METALICAS',
      length: '5',
      width: '1',
      quantity: 5,
      partial: 5,
      unit: 'M2',
    };
    const ventanaRow = {
      ...createBlankRow('GENERAL'),
      id: 'remocion-ventana',
      description: 'REMOCION DE VENTANAS',
      length: '10',
      width: '5',
      quantity: 50,
      partial: 50,
      unit: 'M2',
    };
    const state = stateWithRows([rejasRow, ventanaRow]);

    // Vincular acumulando en Remoción de rejas (5 M2 propios + 50 M2 de ventana = 55 M2)
    const linkedState = rowsReducer(state, {
      type: 'LINK_ROWS',
      payload: {
        sourceItemId: 'remocion-ventana',
        targetItemId: 'remocion-rejas',
        isNewRow: false,
        linkConfig: {
          formulaType: 'custom',
          factor: 1,
          mode: 'add',
          label: 'Sumado con: REMOCION DE VENTANAS',
        },
      },
    });

    const updatedRejas = linkedState.rows.find((r) => r.id === 'remocion-rejas');
    expect(updatedRejas.quantity).toBe(55);
    expect(updatedRejas.partials).toHaveLength(2);
    expect(updatedRejas.partials[0].description).toBe('Parcial 1');
    expect(updatedRejas.partials[0].partial).toBe(5);
    expect(updatedRejas.partials[1].description).toBe('Viene de REMOCION DE VENTANAS');
    expect(updatedRejas.partials[1].partial).toBe(50);

    // Si cambia la medición de Remoción de ventana a 60 M2, Remoción de rejas pasa a 5 + 60 = 65 M2
    const afterVentanaEdit = rowsReducer(linkedState, {
      type: 'UPDATE_FIELD',
      payload: {
        itemId: 'remocion-ventana',
        field: 'width',
        value: '6',
        activeChapter: 'GENERAL',
      },
    });
    const rejasAfterVentana = afterVentanaEdit.rows.find((r) => r.id === 'remocion-rejas');
    expect(rejasAfterVentana.quantity).toBe(65);

    // Si cambia la dimensión propia de Remoción de rejas (largo 8 x ancho 1 = 8 M2), pasa a 8 + 60 = 68 M2
    const afterRejasEdit = rowsReducer(afterVentanaEdit, {
      type: 'UPDATE_FIELD',
      payload: {
        itemId: 'remocion-rejas',
        field: 'length',
        value: '8',
        activeChapter: 'GENERAL',
      },
    });
    const rejasAfterOwnEdit = afterRejasEdit.rows.find((r) => r.id === 'remocion-rejas');
    expect(rejasAfterOwnEdit.quantity).toBe(68);

    // Al desvincular, Remoción de rejas recupera su medición propia (8 M2)
    const unlinkedState = rowsReducer(afterRejasEdit, {
      type: 'UNLINK_ROW',
      payload: { itemId: 'remocion-rejas' },
    });
    const unlinkedRejas = unlinkedState.rows.find((r) => r.id === 'remocion-rejas');
    expect(unlinkedRejas.linkedTo).toBeNull();
    expect(unlinkedRejas.quantity).toBe(8);
  });

  it('permite deshacer (UNDO) y rehacer (REDO) cambios en la planilla', () => {
    const row = { ...createBlankRow('GENERAL'), id: 'r1', description: 'Pared', quantity: 10 };
    const state = stateWithRows([row]);

    const afterDelete = rowsReducer(state, {
      type: 'REMOVE_ROW',
      payload: { itemId: 'r1', activeChapter: 'GENERAL' },
    });
    expect(afterDelete.rows.some((r) => r.id === 'r1')).toBe(false);
    expect(afterDelete.history).toHaveLength(1);

    const afterUndo = rowsReducer(afterDelete, { type: 'UNDO' });
    expect(afterUndo.rows.some((r) => r.id === 'r1')).toBe(true);
    expect(afterUndo.rows.find((r) => r.id === 'r1').quantity).toBe(10);

    const afterRedo = rowsReducer(afterUndo, { type: 'REDO' });
    expect(afterRedo.rows.some((r) => r.id === 'r1')).toBe(false);
  });

  it('propaga cambio de geometría y unidad desde la fila padre a sus parciales propios', () => {
    const row = {
      ...createBlankRow('GENERAL'),
      id: 'r-geom',
      unit: 'M3',
      partials: [
        { id: 'p1', length: 0.5, width: '', height: 2, times: 1, partial: 1 },
      ],
    };
    const withCylinder = rowsReducer(stateWithRows([row]), {
      type: 'UPDATE_FIELD',
      payload: { itemId: 'r-geom', field: 'geometryType', value: 'cylinder', activeChapter: 'GENERAL' },
    });
    expect(withCylinder.rows[0].partials[0].geometryType).toBe('cylinder');
    expect(withCylinder.rows[0].quantity).toBe(0.39);

    const switchedToM2 = rowsReducer(withCylinder, {
      type: 'UPDATE_FIELD',
      payload: { itemId: 'r-geom', field: 'unit', value: 'M2', activeChapter: 'GENERAL' },
    });
    expect(switchedToM2.rows[0].unit).toBe('M2');
    expect(switchedToM2.rows[0].quantity).toBe(3.14);
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
