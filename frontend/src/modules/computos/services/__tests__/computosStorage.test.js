import { describe, it, expect, beforeEach } from 'vitest';
import {
  DRAFT_STORAGE_KEY,
  SAVED_LIST_STORAGE_KEY,
  readDraft,
  writeDraft,
  clearDraft,
  getSavedComputosList,
  writeSavedComputosList,
  getComputosOpeningKey,
  hasOpenedComputos,
  markComputosOpened,
  readDraftField,
} from '../computosStorage.js';

function installStorage() {
  const data = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k),
    },
  };
  return data;
}

describe('persistencia de cómputos', () => {
  beforeEach(() => {
    installStorage();
  });

  it('escribe y lee un borrador', () => {
    const draft = { budgetName: 'Obra', items: [{ id: '1' }] };
    expect(writeDraft(draft)).toBe(true);
    expect(readDraft()).toEqual(draft);
    expect(readDraftField('budgetName')).toBe('Obra');
    expect(readDraftField('inexistente', 'fallback')).toBe('fallback');
  });

  it('limpia el borrador', () => {
    writeDraft({ budgetName: 'Obra' });
    clearDraft();
    expect(readDraft()).toBeNull();
  });

  it('maneja JSON inválido sin romper', () => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, '{invalid');
    expect(readDraft()).toBeNull();
  });

  it('lee y escribe la lista de guardados', () => {
    writeSavedComputosList([{ id: 'a' }]);
    expect(getSavedComputosList()).toEqual([{ id: 'a' }]);
    window.localStorage.setItem(SAVED_LIST_STORAGE_KEY, '{"no":"array"}');
    expect(getSavedComputosList()).toEqual([]);
  });

  it('marca la apertura por presupuesto', () => {
    expect(getComputosOpeningKey('b1')).toBe('control_obra_computos_opened_b1');
    expect(hasOpenedComputos('b1')).toBe(false);
    markComputosOpened('b1');
    expect(hasOpenedComputos('b1')).toBe(true);
    expect(hasOpenedComputos('b2')).toBe(false);
  });
});
