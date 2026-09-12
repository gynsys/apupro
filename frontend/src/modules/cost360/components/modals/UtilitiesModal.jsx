import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Wrench, 
  CheckCircle, 
  Sliders, 
  Activity, 
  RefreshCw, 
  Clock, 
  HardDrive, 
  Layers, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { FiDatabase, FiCpu } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiPost, apiGet } from '../../../../lib/apiHelper';
import CategoryManager from '../CategoryManager';

export default function UtilitiesModal({
  isOpen,
  onClose,
  config = {},
  onToggleGlobalCoded,
  onlyCoded = false,
  onToggleOnlyCoded,
  onToggleCategory,
  onLimitChange,
  onUpdateRAGBrain,
}) {
  const navigate = useNavigate();
  const [autoDownloadDebugJson, setAutoDownloadDebugJson] = useState(false);
  const [isUpdatingRAG, setIsUpdatingRAG] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const res = await apiGet('/system/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error('Error fetching system health:', err);
      setHealthError('No se pudo conectar al endpoint de monitoreo (/api/v1/system/health)');
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('auto_download_debug_json') === 'true';
      setAutoDownloadDebugJson(saved);
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleDebug = (e) => {
    const checked = e.target.checked;
    setAutoDownloadDebugJson(checked);
    localStorage.setItem('auto_download_debug_json', checked ? 'true' : 'false');
    if (checked) {
      toast.success('Descarga automática de Debug JSON ACTIVADA');
    } else {
      toast('Descarga automática de Debug JSON DESACTIVADA', { icon: 'ℹ️' });
    }
  };

  const handleRAGUpdate = async () => {
    const confirm = window.confirm("¿Estás seguro de que deseas actualizar el Cerebro RAG? Este proceso toma de 5 a 15 minutos en segundo plano y consumirá CPU del servidor.");
    if (!confirm) return;

    setIsUpdatingRAG(true);
    const toastId = toast.loading('Iniciando actualización del Cerebro IA...');
    try {
      if (onUpdateRAGBrain) {
        await onUpdateRAGBrain();
      } else {
        const response = await apiPost('/admin/update-rag-brain', {});
        if (!response.ok) throw new Error('Failed to update RAG brain');
      }
      toast.success('El Cerebro RAG se está actualizando en el servidor. Estará listo en unos minutos.', { id: toastId, duration: 8000 });
    } catch (err) {
      toast.error('Error al iniciar la actualización del Cerebro RAG', { id: toastId });
    } finally {
      setIsUpdatingRAG(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Wrench size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Utilitarios y Herramientas del Administrador
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Panel centralizado: depuración, filtros de catálogo, límites y motor RAG
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* SECCIÓN 1: Inteligencia Artificial, RAG y Depuración */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FiCpu className="w-4 h-4 text-indigo-600" />
                  Inteligencia Artificial & Motor RAG
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Herramientas del modelo semántico y log de depuración técnica
                </p>
              </div>

              {/* Elemento 1: Debug JSON */}
              <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl border border-slate-700 shadow-xs shrink-0" title="Descarga automáticamente el log técnico JSON de depuración al generar">
                <span className="text-[11px] font-mono font-bold text-slate-200">Debug JSON</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDownloadDebugJson}
                    onChange={handleToggleDebug}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-500 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>
            </div>

            {/* Botones RAG y Auto IA */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Acciones del Motor IA (RAG & Automatización)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRAGUpdate}
                  disabled={isUpdatingRAG}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                  title="Actualizar Cerebro RAG"
                >
                  <FiDatabase className="w-4 h-4" />
                  {isUpdatingRAG ? 'Actualizando Cerebro RAG...' : 'Actualizar Cerebro RAG'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/cost360/market-admin');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer"
                  title="Automatización IA"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Automatización IA (Auto IA)
                </button>
              </div>
            </div>

            {/* Status info de Debug JSON */}
            {autoDownloadDebugJson && (
              <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Debug JSON Activo:</span> Cada vez que generes un APU con IA, se descargará un archivo <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[11px]">debug_apu_*.json</code> con el árbol semántico y respuestas del LLM.
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: Filtros de Catálogo y Partidas */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                Filtros de Catálogo y Visualización de Partidas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configura los filtros de codificación y la visibilidad de capítulos para ordenar la interfaz
              </p>
            </div>

            {/* Filtro Publico Global y Filtro Local */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Filtro Publico Global */}
              <div className="flex items-center gap-3 px-3.5 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl" title="Afecta a todos los usuarios del sistema">
                <input
                  type="checkbox"
                  id="modalGlobalCoded"
                  checked={config?.forceOnlyCodedMaster === true}
                  onChange={(e) => onToggleGlobalCoded && onToggleGlobalCoded(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <label htmlFor="modalGlobalCoded" className="text-xs font-bold text-indigo-900 cursor-pointer block">
                    Filtro Publico Global
                  </label>
                  <span className="text-[11px] text-indigo-600 block">
                    {config?.forceOnlyCodedMaster ? 'Activado: exige código a todos los usuarios' : 'Desactivado: muestra todo'}
                  </span>
                </div>
              </div>

              {/* Filtro Local (Tu vista) */}
              <div className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                <input
                  type="checkbox"
                  id="modalOnlyCoded"
                  checked={onlyCoded}
                  onChange={(e) => onToggleOnlyCoded && onToggleOnlyCoded(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <label htmlFor="modalOnlyCoded" className="text-xs font-medium text-slate-700 cursor-pointer block">
                    Filtro Local (Tu vista)
                  </label>
                  <span className="text-[11px] text-slate-500 block">
                    {onlyCoded ? 'Activado: solo partidas codificadas' : 'Desactivado: muestra todas las partidas'}
                  </span>
                </div>
              </div>
            </div>

            {/* Visibilidad de Capítulos */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 block">
                  Visibilidad de Capítulos COVENIN
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Habilita o desactiva capítulos completos en el catálogo
                </span>
              </div>
              <div>
                <CategoryManager config={config} onToggleCategory={onToggleCategory} />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Configuración y Límites de Bases de Datos */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                Límites y Parámetros de Base de Datos
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Control de cuotas y parámetros para usuarios del sistema
              </p>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div>
                <span className="text-xs font-bold text-slate-700 block">Límite de Bases de Datos por Usuario</span>
                <span className="text-[11px] text-slate-500 block">Cantidad máxima de bases de datos personalizadas permitidas por usuario</span>
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                <label className="text-xs font-semibold text-slate-600">Límite BD/Usuario:</label>
                <input 
                  type="number"
                  min="1"
                  max="20"
                  value={config?.max_user_databases || 2}
                  onChange={(e) => onLimitChange && onLimitChange(e.target.value)}
                  className="w-12 text-center text-sm font-medium border border-slate-300 rounded focus:outline-none focus:border-blue-500 py-0.5"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: Diagnóstico y Salud del Sistema (Monitoreo 24/7) */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Diagnóstico y Salud del Sistema (Monitoreo 24/7)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Estado en vivo de bases de datos, Redis, Cerebro de IA, Cron de suscripciones y disco
                </p>
              </div>

              <button
                type="button"
                onClick={fetchHealth}
                disabled={loadingHealth}
                className="flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                title="Actualizar estado del sistema"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                <span>{loadingHealth ? 'Verificando...' : 'Actualizar'}</span>
              </button>
            </div>

            {loadingHealth && !healthData ? (
              <div className="flex items-center justify-center py-6 gap-3 text-slate-500 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Consultando telemetría del servidor...</span>
              </div>
            ) : healthError ? (
              <div className="flex items-center gap-2.5 p-3.5 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{healthError}</span>
              </div>
            ) : healthData ? (
              <div className="space-y-3">
                {/* Banner de Estado Global */}
                <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${
                  healthData.status === 'healthy' 
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : healthData.status === 'degraded'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-red-50/80 border-red-200 text-red-900'
                }`}>
                  <div className="flex items-center gap-2">
                    {healthData.status === 'healthy' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="text-xs font-bold">
                      {healthData.status === 'healthy' ? 'Sistema 100% Operativo' : healthData.status === 'degraded' ? 'Sistema Operativo (con avisos)' : 'Alerta en Servicios Críticos'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-600">
                    Uptime: {Math.floor((healthData.uptime_seconds || 0) / 3600)}h {Math.floor(((healthData.uptime_seconds || 0) % 3600) / 60)}m
                  </span>
                </div>

                {/* Grid de Métricas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* PostgreSQL */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FiDatabase className="w-3.5 h-3.5 text-blue-600" />
                        Bases de Datos
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        healthData.components?.database_primary?.status === 'connected'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {healthData.components?.database_primary?.status === 'connected' ? `Conectada (${healthData.components?.database_primary?.latency_ms} ms)` : 'Desconectada'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      PostgreSQL Primaria ({healthData.components?.database_primary?.latency_ms} ms) · Arko ({healthData.components?.database_arko?.latency_ms} ms)
                    </p>
                  </div>

                  {/* Cerebro de IA */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FiCpu className="w-3.5 h-3.5 text-indigo-600" />
                        Cerebro de IA & RAG
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        healthData.components?.ai_engine?.is_loaded
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {healthData.components?.ai_engine?.is_loaded ? 'Cargado en RAM' : 'No cargado'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {healthData.components?.ai_engine?.embeddings_count?.toLocaleString() || '13.608'} embeddings mapeados para búsqueda híbrida
                    </p>
                  </div>

                  {/* Cron de Suscripciones */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-600" />
                        Cron de Suscripciones
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        healthData.components?.cron_subscription_expirations?.status === 'healthy'
                          ? 'bg-emerald-100 text-emerald-800'
                          : healthData.components?.cron_subscription_expirations?.status === 'initializing'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {healthData.components?.cron_subscription_expirations?.status === 'healthy'
                          ? `Activo (hace ${healthData.components?.cron_subscription_expirations?.minutes_since_last_run ?? 0}m)`
                          : healthData.components?.cron_subscription_expirations?.status === 'initializing'
                          ? 'Iniciando'
                          : 'Demorado'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {healthData.components?.cron_subscription_expirations?.total_runs ?? 0} corridas · {healthData.components?.cron_subscription_expirations?.total_errors ?? 0} errores · Heartbeat: {healthData.components?.cron_subscription_expirations?.healthchecks_ping_enabled ? 'Conectado' : 'Local'}
                    </p>
                  </div>

                  {/* Disco del Servidor */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-cyan-600" />
                        Almacenamiento
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        (healthData.components?.system_resources?.disk?.percent_used ?? 0) < 85
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {healthData.components?.system_resources?.disk?.percent_used}% usado
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          (healthData.components?.system_resources?.disk?.percent_used ?? 0) < 85
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(healthData.components?.system_resources?.disk?.percent_used ?? 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 pt-0.5">
                      {healthData.components?.system_resources?.disk?.free_gb} GB libres de {healthData.components?.system_resources?.disk?.total_gb} GB
                    </p>
                  </div>
                </div>

                {/* Footer del diagnóstico */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/80">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Monitoreo automático activo cada 5 minutos
                  </span>
                  <a
                    href="/api/v1/system/health"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                  >
                    Ver JSON crudo <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            Cerrar Utilitarios
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
