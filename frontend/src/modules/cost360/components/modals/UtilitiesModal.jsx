import React, { useState, useEffect } from 'react';
import { X, Wrench, FileCode, CheckCircle, AlertCircle, ExternalLink, Sparkles, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function UtilitiesModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [autoDownloadDebugJson, setAutoDownloadDebugJson] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('auto_download_debug_json') === 'true';
      setAutoDownloadDebugJson(saved);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-slide-up">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Wrench size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Utilitarios del Administrador
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Herramientas técnicas, diagnóstico y depuración de CostBase 360
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Card: Debug JSON Toggle */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="pr-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  Registro Técnico de Generación IA
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Descarga automática del archivo JSON de depuración técnica al procesar APUs.
                </p>
              </div>

              {/* Exact user-specified Debug JSON element */}
              <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl border border-slate-700 shadow-xs shrink-0">
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

            {/* Status Information */}
            <div className="pt-3 border-t border-slate-200">
              {autoDownloadDebugJson ? (
                <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Modo Depuración Activo:</span> Cada vez que generes un APU con IA, el navegador descargará automáticamente un archivo <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono text-[11px]">debug_apu_*.json</code> con el árbol semántico RAG, insumos clasificados y la respuesta del LLM.
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Modo Depuración Desactivado:</span> Los APUs se generan de forma limpia sin generar descargas de archivos en el navegador del cliente.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Accesos Rápidos de Utilidad */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Accesos Rápidos Técnicos
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onClose();
                  navigate('/cost360/ai-apu');
                }}
                className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Generador de APU</div>
                    <div className="text-[10px] text-slate-500">Probar prompt con IA</div>
                  </div>
                </div>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigate('/cost360/market-admin');
                }}
                className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-amber-300 hover:shadow-sm transition-all text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100 transition-colors">
                    <Database size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Automatización IA</div>
                    <div className="text-[10px] text-slate-500">Gestión de mercado y RAG</div>
                  </div>
                </div>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-amber-600 transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
