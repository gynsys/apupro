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
  AlertTriangle,
  Folder,
  FolderPlus,
  Mail,
  Send,
  UserCheck,
  Copy,
  Check,
  AlertCircle,
  Users
} from 'lucide-react';
import { FiDatabase, FiCpu } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiPost, apiGet } from '../../../../lib/apiHelper';
import { 
  isFileSystemAccessSupported, 
  pickDebugDirectory, 
  getSavedDebugDirectoryName, 
  clearDebugDirectoryHandle 
} from '../../../../utils/debugStorage';
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
  const [debugDirName, setDebugDirName] = useState(null);
  const [isFSSupported, setIsFSSupported] = useState(false);
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
      setIsFSSupported(isFileSystemAccessSupported());
      setDebugDirName(getSavedDebugDirectoryName());
      fetchHealth();
    }
  }, [isOpen]);

  const [recovering, setRecovering] = useState(null); // 'cron' | 'ai-brain' | 'connections' | 'verification-service' | 'all'
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmailInput, setTestEmailInput] = useState('');
  const [testingDelivery, setTestingDelivery] = useState(false);
  const [testDeliveryResult, setTestDeliveryResult] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null); // 'verify:email' | 'resend:email'
  const [copiedCodeEmail, setCopiedCodeEmail] = useState(null);

  const executeRecovery = async (action) => {
    setRecovering(action);
    const labels = {
      cron: 'Cron de Suscripciones',
      'ai-brain': 'Cerebro de IA',
      connections: 'Conexiones DB & Redis',
      'verification-service': 'Servicio de Códigos de Verificación',
      all: 'Auto-Reparación Integral',
    };
    const toastId = toast.loading(`Recuperando ${labels[action]}...`);
    try {
      const res = await apiPost(`/system/recover/${action}`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast.success(`✅ ${labels[action]} recuperado.\n${data.message || ''}`, { id: toastId, duration: 5000 });
      // Refrescar métricas automáticamente tras recuperación
      await fetchHealth();
    } catch (err) {
      toast.error(`❌ Error al recuperar ${labels[action]}: ${err.message}`, { id: toastId, duration: 6000 });
    } finally {
      setRecovering(null);
    }
  };

  const handleTestVerificationEmail = async (e) => {
    if (e) e.preventDefault();
    setTestingDelivery(true);
    setTestDeliveryResult(null);
    const targetEmail = testEmailInput.trim();
    const toastId = toast.loading(`Enviando código de prueba a ${targetEmail || 'tu correo'}...`);
    try {
      const res = await apiPost('/system/verification/test-send', { 
        email: targetEmail || undefined 
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorMsg = data.message || data.detail || 'Fallo en la prueba de entrega';
        setTestDeliveryResult({
          success: false,
          message: errorMsg,
          error_detail: data.error_detail,
          solution_hint: data.solution_hint,
          latency_ms: data.latency_ms,
          provider: data.provider
        });
        toast.error(`❌ Falla en entrega: ${errorMsg}`, { id: toastId, duration: 7000 });
      } else {
        setTestDeliveryResult({
          success: true,
          message: data.message,
          latency_ms: data.latency_ms,
          provider: data.provider
        });
        toast.success(`✅ ${data.message}`, { id: toastId, duration: 6000 });
      }
      await fetchHealth();
    } catch (err) {
      toast.error(`Error al ejecutar prueba de entrega: ${err.message}`, { id: toastId });
      setTestDeliveryResult({
        success: false,
        message: err.message,
      });
    } finally {
      setTestingDelivery(false);
    }
  };

  const handleManualVerify = async (email) => {
    if (!window.confirm(`¿Aprobar y activar inmediatamente la cuenta de "${email}" sin requerir código de verificación por correo?`)) {
      return;
    }
    setActionInProgress(`verify:${email}`);
    const toastId = toast.loading(`Activando cuenta para ${email}...`);
    try {
      const res = await apiPost('/system/verification/manual-verify', { email });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo verificar al usuario');
      }
      toast.success(`✅ ${data.message}`, { id: toastId, duration: 5000 });
      await fetchHealth();
    } catch (err) {
      toast.error(`❌ Error: ${err.message}`, { id: toastId, duration: 6000 });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAdminResendCode = async (email) => {
    setActionInProgress(`resend:${email}`);
    const toastId = toast.loading(`Reenviando código a ${email}...`);
    try {
      const res = await apiPost('/system/verification/resend-code', { email });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo reenviar el código');
      }
      toast.success(`✅ ${data.message}`, { id: toastId, duration: 5000 });
      await fetchHealth();
    } catch (err) {
      toast.error(`❌ ${err.message}`, { id: toastId, duration: 7000 });
    } finally {
      setActionInProgress(null);
    }
  };

  const copyToClipboard = (text, email) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeEmail(email);
    toast.success(`Código ${text} copiado al portapapeles`, { icon: '📋' });
    setTimeout(() => setCopiedCodeEmail(null), 2500);
  };

  if (!isOpen) return null;

  const handleToggleDebug = async (e) => {
    const checked = e.target.checked;
    setAutoDownloadDebugJson(checked);
    localStorage.setItem('auto_download_debug_json', checked ? 'true' : 'false');
    if (checked) {
      if (isFileSystemAccessSupported() && !getSavedDebugDirectoryName()) {
        toast('Selecciona la carpeta "debug" para archivar directamente allí', { icon: '📁', duration: 4000 });
        const res = await pickDebugDirectory();
        if (res.success) {
          setDebugDirName(res.name);
          toast.success(`Carpeta "${res.name}" configurada para Debug JSON`, { icon: '📁' });
          return;
        }
      }
      toast.success('Descarga automática de Debug JSON ACTIVADA');
    } else {
      toast('Descarga automática de Debug JSON DESACTIVADA', { icon: 'ℹ️' });
    }
  };

  const handleSelectDirectory = async () => {
    const res = await pickDebugDirectory();
    if (res.success) {
      setDebugDirName(res.name);
      toast.success(`Carpeta "${res.name}" configurada para Debug JSON`, { icon: '📁' });
    } else if (res.error) {
      toast.error(res.error);
    }
  };

  const handleClearDirectory = async () => {
    await clearDebugDirectoryHandle();
    setDebugDirName(null);
    toast('Carpeta personalizada removida. Se usará la carpeta de Descargas estándar.', { icon: 'ℹ️' });
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 bg-emerald-50/90 p-3.5 rounded-xl border border-emerald-200 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div>
                      <span className="font-bold">Debug JSON Activo:</span> Cada vez que generes un APU con IA, se archivará el archivo <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[11px] text-emerald-950 font-semibold">debug_apu_*.json</code>.
                    </div>
                    {debugDirName ? (
                      <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                        <Folder className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Carpeta de destino configurada: <strong className="font-mono bg-emerald-200/70 text-emerald-950 px-1.5 py-0.5 rounded font-bold">{debugDirName}/</strong></span>
                      </div>
                    ) : (
                      <div className="text-slate-600 text-[11px]">
                        Destino actual: Carpeta de <span className="font-semibold text-slate-800">Descargas</span> estándar.
                      </div>
                    )}
                  </div>
                </div>

                {isFSSupported && (
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={handleSelectDirectory}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all hover:scale-[1.02] cursor-pointer"
                      title="Seleccionar carpeta específica en tu equipo (ej. Descargas/debug)"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      {debugDirName ? 'Cambiar carpeta' : 'Elegir carpeta destino'}
                    </button>
                    {debugDirName && (
                      <button
                        type="button"
                        onClick={handleClearDirectory}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Restablecer a descargas predeterminadas"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
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
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1.5">
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
                      Primaria ({healthData.components?.database_primary?.latency_ms} ms) · Arko ({healthData.components?.database_arko?.latency_ms} ms)
                    </p>
                    {healthData.components?.database_primary?.status !== 'connected' && (
                      <button
                        type="button"
                        onClick={() => executeRecovery('connections')}
                        disabled={recovering !== null}
                        className="w-full mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${recovering === 'connections' ? 'animate-spin' : ''}`} />
                        {recovering === 'connections' ? 'Restableciendo...' : 'Restablecer Conexiones'}
                      </button>
                    )}
                  </div>

                  {/* Cerebro de IA */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1.5">
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
                      {healthData.components?.ai_engine?.embeddings_count?.toLocaleString() || '13.608'} embeddings mapeados
                    </p>
                    {!healthData.components?.ai_engine?.is_loaded && (
                      <button
                        type="button"
                        onClick={() => executeRecovery('ai-brain')}
                        disabled={recovering !== null}
                        className="w-full mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${recovering === 'ai-brain' ? 'animate-spin' : ''}`} />
                        {recovering === 'ai-brain' ? 'Cargando IA...' : 'Recargar Cerebro de IA'}
                      </button>
                    )}
                  </div>

                  {/* Cron de Suscripciones */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1.5">
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
                      {healthData.components?.cron_subscription_expirations?.total_runs ?? 0} corridas · {healthData.components?.cron_subscription_expirations?.total_errors ?? 0} errores
                    </p>
                    <button
                      type="button"
                      onClick={() => executeRecovery('cron')}
                      disabled={recovering !== null}
                      className="w-full mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${recovering === 'cron' ? 'animate-spin' : ''}`} />
                      {recovering === 'cron' ? 'Ejecutando Cron...' : 'Forzar Ejecución Ahora'}
                    </button>
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

                  {/* Envío de Códigos de Verificación (Auth / Registro) */}
                  <div className="sm:col-span-2 p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          healthData.components?.verification_email_service?.status === 'healthy'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : healthData.components?.verification_email_service?.status === 'simulated'
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-800">
                              Envío de Códigos de Verificación (Auth / Registro)
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              healthData.components?.verification_email_service?.status === 'healthy'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : healthData.components?.verification_email_service?.status === 'simulated'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {healthData.components?.verification_email_service?.status === 'healthy'
                                ? `Operativo (${healthData.components?.verification_email_service?.active_provider?.toUpperCase()})`
                                : healthData.components?.verification_email_service?.status === 'simulated'
                                ? 'Modo Simulación (Sin API Key)'
                                : 'Falla de Entrega'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Transporte: <span className="font-semibold text-slate-700">
                              {healthData.components?.verification_email_service?.active_provider === 'resend' 
                                ? 'Resend API (Cloud)'
                                : healthData.components?.verification_email_service?.active_provider === 'smtp'
                                ? `SMTP (${healthData.components?.verification_email_service?.smtp_host || 'Servidor'}:${healthData.components?.verification_email_service?.smtp_port || 587})`
                                : 'Simulador Local (Los correos no salen a internet)'}
                            </span> · Remitente: <span className="font-mono text-slate-600">{healthData.components?.verification_email_service?.resend_from_email || 'info@costbase.net'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setTestDeliveryResult(null);
                            setShowTestEmailModal(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.02] cursor-pointer"
                          title="Probar transporte de correos enviando un código de prueba"
                        >
                          <Send className="w-3 h-3" />
                          <span>Probar Envío</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => executeRecovery('verification-service')}
                          disabled={recovering !== null}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                          title="Restablecer servicio y telemetría de verificación"
                        >
                          <RefreshCw className={`w-3 h-3 ${recovering === 'verification-service' ? 'animate-spin' : ''}`} />
                          <span>Restablecer</span>
                        </button>
                      </div>
                    </div>

                    {/* Fila de métricas rápidas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                        <span className="text-slate-500 block text-[10px]">Historial de Entregas</span>
                        <span className="font-bold text-slate-800">
                          {healthData.components?.verification_email_service?.total_sent || 0} exitosos · {healthData.components?.verification_email_service?.total_errors || 0} errores
                        </span>
                      </div>

                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                        <span className="text-slate-500 block text-[10px]">Última Entrega</span>
                        <span className="font-medium text-slate-700 truncate block" title={healthData.components?.verification_email_service?.last_delivery?.recipient || 'Sin envíos registrados'}>
                          {healthData.components?.verification_email_service?.last_delivery 
                            ? `${healthData.components?.verification_email_service?.last_delivery?.recipient} (${healthData.components?.verification_email_service?.last_delivery?.status})`
                            : 'Sin actividad reciente'}
                        </span>
                      </div>

                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                        <span className="text-slate-500 block text-[10px]">Usuarios en Espera (Redis)</span>
                        <span className={`font-bold ${
                          (healthData.components?.verification_email_service?.pending_count || 0) > 0 
                            ? 'text-amber-700' 
                            : 'text-slate-700'
                        }`}>
                          {healthData.components?.verification_email_service?.pending_count || 0} pendientes (TTL 15 min)
                        </span>
                      </div>
                    </div>

                    {/* ALERTA VISIBLE SI HAY ERROR */}
                    {healthData.components?.verification_email_service?.status === 'error' && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-red-800 font-bold">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>Fallo de Entrega en el Sistema de Correos</span>
                        </div>
                        <p className="text-red-700 font-mono text-[11px] bg-red-100/70 p-2 rounded-lg border border-red-200/60 break-words">
                          {healthData.components?.verification_email_service?.last_error?.error_detail || 'Error desconocido al intentar enviar el correo de verificación.'}
                        </p>
                        {healthData.components?.verification_email_service?.last_error?.solution_hint && (
                          <p className="text-[11px] text-red-700 font-medium">
                            💡 <strong>Diagnóstico / Solución:</strong> {healthData.components?.verification_email_service?.last_error?.solution_hint}
                          </p>
                        )}
                      </div>
                    )}

                    {/* AVISO VISIBLE SI ESTÁ EN MODO SIMULACIÓN */}
                    {healthData.components?.verification_email_service?.status === 'simulated' && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Atención Super Admin: El sistema está en Modo Simulación</span>
                        </div>
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          La variable <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">RESEND_API_KEY</code> en <code className="font-mono">backend/.env</code> no está configurada o contiene un placeholder por defecto (<code className="font-mono">your_resend_api_key_here</code>), y no hay credenciales SMTP. Los usuarios que se registren <strong>no recibirán el código en su correo real</strong>. Puedes activarlos manualmente abajo o configurar una clave real de Resend (<code className="font-mono">re_...</code>).
                        </p>
                      </div>
                    )}

                    {/* LISTADO DE USUARIOS ATASCADOS / PENDIENTES */}
                    {(healthData.components?.verification_email_service?.pending_verifications?.length > 0) && (
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-700" />
                            <span className="text-xs font-bold text-indigo-900">
                              {healthData.components?.verification_email_service?.pending_verifications?.length} usuario(s) esperando verificación
                            </span>
                          </div>
                          <span className="text-[10px] text-indigo-600 font-medium">
                            Puedes activar su cuenta con 1 clic o copiar su código
                          </span>
                        </div>

                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {healthData.components?.verification_email_service?.pending_verifications?.map((item) => (
                            <div key={item.email} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs gap-2 text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">{item.email}</span>
                                  {item.full_name && (
                                    <span className="text-slate-400 text-[11px]">({item.full_name})</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                  <span>Código generado: <strong className="font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-bold tracking-wider">{item.code}</strong></span>
                                  <span>·</span>
                                  <span>Expira en: {Math.floor(item.ttl_seconds / 60)}m {item.ttl_seconds % 60}s</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(item.code, item.email)}
                                  className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                                  title="Copiar código al portapapeles"
                                >
                                  {copiedCodeEmail === item.email ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  <span>{copiedCodeEmail === item.email ? 'Copiado' : 'Copiar'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleAdminResendCode(item.email)}
                                  disabled={actionInProgress !== null}
                                  className="flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                  title="Reintentar envío de correo al usuario"
                                >
                                  <Send className={`w-3 h-3 ${actionInProgress === `resend:${item.email}` ? 'animate-spin' : ''}`} />
                                  <span>{actionInProgress === `resend:${item.email}` ? 'Enviando...' : 'Reenviar'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleManualVerify(item.email)}
                                  disabled={actionInProgress !== null}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                  title="Aprobar y activar inmediatamente esta cuenta"
                                >
                                  <UserCheck className={`w-3 h-3 ${actionInProgress === `verify:${item.email}` ? 'animate-spin' : ''}`} />
                                  <span>{actionInProgress === `verify:${item.email}` ? 'Activando...' : 'Aprobar y Activar'}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón Maestro de Auto-Reparación */}
                <button
                  type="button"
                  onClick={() => executeRecovery('all')}
                  disabled={recovering !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-60"
                >
                  {recovering === 'all' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Layers className="w-4 h-4" />
                  )}
                  {recovering === 'all' ? 'Reparando Sistema...' : '🔧 Auto-Reparación Integral (DB + Redis + IA + Cron + Auth Email)'}
                </button>

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

        {/* Modal Emergente de Prueba de Entrega */}
        {showTestEmailModal && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  Prueba de Entrega de Códigos
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setShowTestEmailModal(false);
                    setTestDeliveryResult(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                Envía un correo con código de 6 dígitos de prueba para validar en vivo el transporte (Resend / SMTP), medir la latencia y observar el error exacto si falla.
              </p>

              <form onSubmit={handleTestVerificationEmail} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Correo destino para la prueba:
                  </label>
                  <input
                    type="email"
                    value={testEmailInput}
                    onChange={(e) => setTestEmailInput(e.target.value)}
                    placeholder="Ingresa correo (deja vacío para usar tu email de admin)"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {testDeliveryResult && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    testDeliveryResult.success 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-1.5">
                        {testDeliveryResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span>{testDeliveryResult.success ? 'Envío Exitoso' : 'Error en la Entrega'}</span>
                      </div>
                      {testDeliveryResult.latency_ms > 0 && (
                        <span className="text-[10px] font-mono text-slate-500">
                          {testDeliveryResult.latency_ms} ms · {testDeliveryResult.provider?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono break-words">{testDeliveryResult.message}</p>
                    {testDeliveryResult.solution_hint && (
                      <p className="text-[11px] font-sans text-slate-700 pt-1 border-t border-slate-200/60">
                        💡 <strong>Solución:</strong> {testDeliveryResult.solution_hint}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTestEmailModal(false);
                      setTestDeliveryResult(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={testingDelivery}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Send className={`w-3.5 h-3.5 ${testingDelivery ? 'animate-spin' : ''}`} />
                    <span>{testingDelivery ? 'Enviando prueba...' : 'Enviar Prueba Ahora'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
