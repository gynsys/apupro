import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSuperAdminOfflineAllowed,
  isDeviceOfflineModeActive,
  persistSuperAdminUser,
  getPersistedSuperAdminUser,
  isNetworkOfflineError,
  saveOfflineBudgetsList,
  getOfflineBudgetsList,
  saveOfflineBudgetDetail,
  getOfflineBudgetDetail,
  saveOfflineCoveninCatalog,
  searchOfflineCoveninCatalog,
  enqueueOfflineOperation,
  getOfflineOutbox,
  removeOfflineOperation,
  clearAllOfflineData,
} from '../index.js';

function installWindowStorage() {
  const data = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k),
      clear: () => data.clear(),
    },
  };
  return data;
}

describe('Módulo Offline exclusivo para Superadmin', () => {
  beforeEach(async () => {
    installWindowStorage();
    await clearAllOfflineData();
  });

  it('autoriza únicamente al Superadmin (is_superadmin=true o admin@arko360.net)', () => {
    expect(isSuperAdminOfflineAllowed(null)).toBe(false);
    expect(isSuperAdminOfflineAllowed({ email: 'cliente@empresa.com', is_superadmin: false })).toBe(false);
    expect(isSuperAdminOfflineAllowed({ email: 'admin@arko360.net' })).toBe(true);
    expect(isSuperAdminOfflineAllowed({ email: 'otro@arko360.net', is_superadmin: true })).toBe(true);
  });

  it('persiste la sesión offline solo para el Superadmin y limpia la de usuarios normales', () => {
    const regularUser = { id: 99, email: 'user@correo.com', is_superadmin: false };
    persistSuperAdminUser(regularUser);
    expect(isDeviceOfflineModeActive()).toBe(false);
    expect(getPersistedSuperAdminUser()).toBeNull();

    const superAdmin = { id: 1, email: 'admin@arko360.net', is_superadmin: true };
    persistSuperAdminUser(superAdmin);
    expect(isDeviceOfflineModeActive()).toBe(true);
    expect(getPersistedSuperAdminUser()).toEqual(superAdmin);
  });

  it('almacena presupuestos, catálogo COVENIN y cola outbox solo cuando el modo Superadmin está activo', async () => {
    // Con usuario no-superadmin no debe guardar nada
    await saveOfflineBudgetsList([{ id: 10, project_name: 'Obra A' }]);
    expect(await getOfflineBudgetsList()).toBeNull();

    // Activando Superadmin
    persistSuperAdminUser({ id: 1, email: 'admin@arko360.net', is_superadmin: true });

    await saveOfflineBudgetsList([{ id: 10, project_name: 'Ikatira Ina' }]);
    const list = await getOfflineBudgetsList();
    expect(list).toHaveLength(1);
    expect(list[0].project_name).toBe('Ikatira Ina');

    await saveOfflineBudgetDetail({
      id: 10,
      project_name: 'Ikatira Ina',
      items: [{ id: 101, code: 'E132', description: 'REMOCION DE VENTANAS' }],
    });
    const detail = await getOfflineBudgetDetail(10);
    expect(detail.items).toHaveLength(1);

    await saveOfflineCoveninCatalog([
      { code: 'E132410000', description: 'REMOCION DE VENTANAS METALICAS', unit: 'M2' },
      { code: 'E325000120', description: 'CONCRETO DE RCC 210 KG/CM2 EN COLUMNAS', unit: 'M3' },
    ]);

    const matches = await searchOfflineCoveninCatalog('remocion ventanas');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].code).toBe('E132410000');

    const op = await enqueueOfflineOperation({
      type: 'SAVE_COMPUTOS_DRAFT',
      payload: { id: 'draft-1', name: 'Ikatira Ina' },
    });
    expect(op.opId).toBeTruthy();

    const queue = await getOfflineOutbox();
    expect(queue).toHaveLength(1);

    await removeOfflineOperation(op.opId);
    expect(await getOfflineOutbox()).toHaveLength(0);
  });

  it('detecta errores de red sin conexión correctamente', () => {
    expect(isNetworkOfflineError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkOfflineError(new Error('HTTP 401 Unauthorized'))).toBe(false);
  });

  it('recupera presupuestos con ID tipo UUID (string) y usa fallback de lista resumen si no había detalle previo', async () => {
    persistSuperAdminUser({ id: 1, email: 'admin@arko360.net', is_superadmin: true });

    const uuidId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    await saveOfflineBudgetDetail({
      id: uuidId,
      project_name: 'Presupuesto UUID',
      items: [{ id: 'item-uuid-1', description: 'PARTIDA DE PRUEBA' }],
    });

    const loadedUuid = await getOfflineBudgetDetail(uuidId);
    expect(loadedUuid).not.toBeNull();
    expect(loadedUuid.project_name).toBe('Presupuesto UUID');
    expect(loadedUuid.items).toHaveLength(1);

    // Fallback desde lista resumen cuando el detalle aún no se había descargado
    const summaryOnlyId = 'f9e8d7c6-b5a4-3210-fedc-ba9876543210';
    await saveOfflineBudgetsList([
      { id: summaryOnlyId, project_name: 'Solo en Resumen', currency: 'USD' },
    ]);

    const fallbackBudget = await getOfflineBudgetDetail(summaryOnlyId);
    expect(fallbackBudget).not.toBeNull();
    expect(fallbackBudget.project_name).toBe('Solo en Resumen');
    expect(Array.isArray(fallbackBudget.items)).toBe(true);
  });
});
