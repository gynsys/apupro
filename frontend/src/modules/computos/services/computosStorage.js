/**
 * Persistencia local de la planilla de cómputos.
 *
 * Mantiene las claves históricas para no perder borradores existentes.
 */

export const DRAFT_STORAGE_KEY = 'costbase_computos_saved_draft_v2';
export const SAVED_LIST_STORAGE_KEY = 'costbase_computos_saved_list_v2';

function storage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

export function readJson(key, fallback = null) {
  const store = storage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
}

export function writeJson(key, value) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (_e) {
    return false;
  }
}

export function removeKey(key) {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch (_e) {
    return false;
  }
}

export function readDraft() {
  return readJson(DRAFT_STORAGE_KEY, null);
}

export function writeDraft(draft) {
  return writeJson(DRAFT_STORAGE_KEY, draft);
}

export function clearDraft() {
  return removeKey(DRAFT_STORAGE_KEY);
}

export function getSavedComputosList() {
  const list = readJson(SAVED_LIST_STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function writeSavedComputosList(list) {
  return writeJson(SAVED_LIST_STORAGE_KEY, Array.isArray(list) ? list : []);
}

export function getComputosOpeningKey(budgetId) {
  return `control_obra_computos_opened_${budgetId || 'budget'}`;
}

export function hasOpenedComputos(budgetId) {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(getComputosOpeningKey(budgetId)) === '1';
  } catch (_e) {
    return false;
  }
}

export function markComputosOpened(budgetId) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(getComputosOpeningKey(budgetId), '1');
    return true;
  } catch (_e) {
    return false;
  }
}

export function readDraftField(field, fallback = null) {
  const draft = readDraft();
  if (!draft || draft[field] === undefined || draft[field] === null) return fallback;
  return draft[field];
}
