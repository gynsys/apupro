import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, X, Globe, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';

export default function ShareBudgetModal({ isOpen, onClose, budget }) {
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && budget?.id) {
      handleGenerateShareLink();
    } else {
      setShareData(null);
      setCopied(false);
    }
  }, [isOpen, budget?.id]);

  const handleGenerateShareLink = async () => {
    setLoading(true);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/budgets/${budget.id}/share`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setShareData(data);
      } else {
        toast.error('Error al generar enlace de compartición');
      }
    } catch (err) {
      console.error('Error sharing budget:', err);
      toast.error('Error de conexión al generar enlace');
    } finally {
      setLoading(false);
    }
  };

  const getFullShareUrl = () => {
    if (shareData?.share_token) {
      return `${window.location.origin}/budgets/shared/${shareData.share_token}`;
    }
    return shareData?.share_url || '';
  };

  const handleCopy = async () => {
    const url = getFullShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('¡Enlace copiado al portapapeles!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('No se pudo copiar automáticamente');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-amber-600/15 overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado con estilo del modal de impresión */}
        <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
          <div className="flex items-center gap-2.5">
            <Share2 className="text-sky-600" size={22} />
            <div>
              <h2 className="m-0 text-xl font-bold text-amber-900 leading-tight">Compartir Presupuesto</h2>
              <p className="text-xs text-amber-800/80 m-0">Portabilidad y clonación rápida en la nube</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1"
          >
            <X size={22} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Tarjeta del proyecto */}
          <div className="bg-white/60 border border-amber-600/15 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900/70 block">
              Proyecto a Compartir
            </span>
            <h3 className="text-base font-bold text-amber-950 mt-0.5 truncate">
              {budget?.name}
            </h3>
            {budget?.client_name && (
              <p className="text-xs text-slate-600 mt-1">
                Cliente: <span className="font-semibold text-slate-700">{budget.client_name}</span>
              </p>
            )}
          </div>

          {/* Estado de carga o Enlace */}
          {loading ? (
            <div className="py-8 text-center text-amber-900/70 text-sm font-medium animate-pulse">
              Generando enlace seguro en la nube...
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                <Globe size={15} className="text-sky-600" />
                Enlace Único de Importación
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getFullShareUrl()}
                  className="flex-1 px-3.5 py-2.5 border border-sky-200 rounded-xl text-xs text-slate-800 font-mono bg-white outline-none select-all focus:border-sky-600 focus:bg-sky-50/50 focus:ring-4 focus:ring-sky-700/10 shadow-sm"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-[0_4px_6px_rgba(2,132,199,0.2)] active:scale-95 ${
                    copied 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                      : 'bg-sky-600 hover:bg-sky-700 text-white hover:-translate-y-[1px]'
                  }`}
                  title="Copiar enlace"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              {/* Banner informativo */}
              <div className="flex items-start gap-2.5 bg-white/50 border border-amber-600/15 rounded-xl p-3 text-xs text-amber-950">
                <ShieldCheck size={18} className="text-sky-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed m-0">
                  Cualquier usuario de CostBase que tenga este enlace podrá <strong>importar y clonar</strong> una copia exacta e independiente en su propia cuenta con un solo clic.
                </p>
              </div>
            </div>
          )}

          {/* Footer del modal: solo botón Cerrar */}
          <div className="flex items-center justify-end pt-3 border-t border-amber-600/15">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border-none text-amber-700 text-sm font-semibold px-5 py-2 cursor-pointer rounded-xl hover:bg-white/40 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
