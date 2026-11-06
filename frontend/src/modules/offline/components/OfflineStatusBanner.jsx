import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, DownloadCloud, RefreshCw, CheckCircle2 } from 'lucide-react';
import { isSuperAdminOfflineAllowed } from '../domain/offlinePolicy.js';
import {
  getOfflineOutbox,
  getOfflineCachedBudgetsCount,
  getOfflineCoveninCatalog,
} from '../storage/indexedDbStore.js';
import {
  prepareDeviceForOfflineWork,
  flushOfflineOutbox,
} from '../services/offlineSyncEngine.js';

/**
 * Indicador compacto y botón "Modo Obra" en la barra superior.
 * Se renderiza ÚNICAMENTE para el Superadmin (`isSuperAdminOfflineAllowed(user)`).
 */
export default function OfflineStatusBanner({ user }) {
  const allowed = isSuperAdminOfflineAllowed(user);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [cachedBudgets, setCachedBudgets] = useState(0);
  const [cachedCovenin, setCachedCovenin] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [progressInfo, setProgressInfo] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const refreshStats = useCallback(async () => {
    if (!allowed) return;
    try {
      const [outbox, bCount, covList] = await Promise.all([
        getOfflineOutbox(),
        getOfflineCachedBudgetsCount(),
        getOfflineCoveninCatalog(),
      ]);
      setPendingCount(outbox.length);
      setCachedBudgets(bCount);
      setCachedCovenin(covList.length);
    } catch (_e) {
      // ignore
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    refreshStats();

    const handleOnline = async () => {
      setIsOnline(true);
      const res = await flushOfflineOutbox();
      await refreshStats();
      if (res.synced > 0) {
        setToastMsg(`✅ ${res.synced} cambio(s) sincronizado(s) con la nube`);
        setTimeout(() => setToastMsg(null), 4000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshStats();
    };

    const handleOutboxUpdated = () => {
      refreshStats();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('costbase:offline-updated', handleOutboxUpdated);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('costbase:offline-updated', handleOutboxUpdated);
    };
  }, [allowed, refreshStats]);

  if (!allowed) return null;

  const handlePrepareOffline = async () => {
    if (preparing || !isOnline) return;
    setPreparing(true);
    setProgressInfo({ step: 'Iniciando descarga offline...', progress: 5 });
    try {
      const summary = await prepareDeviceForOfflineWork({
        user,
        onProgress: (info) => setProgressInfo(info),
      });
      await refreshStats();
      setToastMsg(
        `📥 Modo Obra listo: ${summary.budgetsCached} presupuestos y ${summary.coveninCached} partidas COVENIN en este dispositivo`
      );
      setTimeout(() => setToastMsg(null), 5000);
    } catch (err) {
      setToastMsg(`⚠️ ${err.message || 'Error preparando Modo Obra'}`);
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setPreparing(false);
      setProgressInfo(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5 relative">
      {/* Estado Online / Offline */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
          isOnline
            ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200'
            : 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
        }`}
        title={
          isOnline
            ? `Conectado · ${cachedBudgets} presupuestos y ${cachedCovenin} partidas COVENIN guardados en caché local`
            : 'Trabajando sin conexión (Modo Obra Superadmin activo)'
        }
      >
        {isOnline ? (
          <Wifi size={13} className="text-emerald-600 shrink-0" />
        ) : (
          <WifiOff size={13} className="text-amber-700 shrink-0" />
        )}
        <span className="hidden sm:inline">
          {isOnline ? 'Online' : 'Modo Obra (Sin internet)'}
        </span>
        {pendingCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.2 bg-amber-600 text-white rounded-full text-[10px]">
            {pendingCount} pend.
          </span>
        )}
      </div>

      {/* Botón Preparar Modo Obra (solo cuando hay internet) */}
      {isOnline && (
        <button
          type="button"
          onClick={handlePrepareOffline}
          disabled={preparing}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer min-h-[28px] ${
            cachedBudgets > 0
              ? 'bg-blue-50/90 text-blue-700 border-blue-200 hover:bg-blue-100'
              : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-xs'
          }`}
          title="Descargar todos tus presupuestos, cómputos y catálogo COVENIN para usar sin internet en obra"
        >
          {preparing ? (
            <>
              <RefreshCw size={12} className="animate-spin shrink-0" />
              <span className="truncate max-w-[110px] sm:max-w-[160px]">
                {progressInfo ? `${progressInfo.progress}%` : 'Preparando...'}
              </span>
            </>
          ) : cachedBudgets > 0 ? (
            <>
              <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
              <span className="hidden md:inline">Modo Obra ({cachedBudgets})</span>
              <span className="md:hidden">Obra</span>
            </>
          ) : (
            <>
              <DownloadCloud size={12} className="shrink-0" />
              <span className="hidden sm:inline">Preparar Offline</span>
              <span className="sm:hidden">Offline</span>
            </>
          )}
        </button>
      )}

      {/* Toast flotante de progreso / confirmación */}
      {(preparing && progressInfo) || toastMsg ? (
        <div className="fixed top-16 right-3 z-[9999] max-w-xs sm:max-w-sm bg-slate-900/95 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-semibold flex items-center gap-2">
          {preparing && progressInfo ? (
            <div className="w-full">
              <div className="flex justify-between items-center mb-1">
                <span className="truncate pr-2">{progressInfo.step}</span>
                <span className="text-amber-400 font-bold">{progressInfo.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-200"
                  style={{ width: `${progressInfo.progress}%` }}
                />
              </div>
            </div>
          ) : (
            <span>{toastMsg}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
