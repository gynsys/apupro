import React, { useEffect, useState } from 'react';
import { Check, Copy, Globe, Share2, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';

export default function SharePartidaModal({ isOpen, onClose, budget, item }) {
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && budget?.id && item?.id) {
      setShareData(null);
      setCopied(false);
      generateLink();
    }
  }, [isOpen, budget?.id, item?.id]);

  const generateLink = async () => {
    setLoading(true);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/budgets/${budget.id}/items/${item.id}/share`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('No se pudo generar el enlace');
      }
      setShareData(await res.json());
    } catch (error) {
      console.error('Error sharing item:', error);
      toast.error('No se pudo generar el enlace de la partida');
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = shareData?.share_url
    || (shareData?.share_token
      ? `${window.location.origin}/budgets/shared/partida/${shareData.share_token}`
      : '');

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Enlace de la partida copiado');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-amber-100 font-sans shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[92dvh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-amber-600/15">
        <div className="flex shrink-0 items-center justify-between border-b border-amber-600/15 bg-white/40 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <Share2 className="shrink-0 text-sky-600" size={20} />
            <div>
              <h2 className="m-0 text-lg font-bold leading-tight text-amber-900 sm:text-xl">Compartir Partida</h2>
              <p className="m-0 text-xs text-amber-800/80">Envía esta APU sin compartir todo el presupuesto</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-xl p-2 text-amber-700 transition-colors hover:bg-amber-200/50 hover:text-amber-900"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          <div className="rounded-xl border border-amber-600/20 bg-white/60 p-4 shadow-sm">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-900/70">
              Partida a compartir
            </span>
            <h3 className="mt-0.5 truncate text-base font-bold text-amber-950">
              {item?.description || 'Partida'}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              {budget?.name || budget?.project_name || 'Presupuesto'}
            </p>
          </div>

          {loading ? (
            <div className="animate-pulse py-8 text-center text-sm font-medium text-amber-900/70">
              Generando enlace seguro...
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-amber-900">
                <Globe size={15} className="text-sky-600" />
                Enlace de la partida
              </label>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-xl border border-sky-200 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-800 outline-none select-all focus:border-sky-600 focus:bg-sky-50/50 focus:ring-4 focus:ring-sky-700/10"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-all active:scale-95 ${
                    copied ? 'bg-emerald-600' : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-amber-600/15 bg-white/50 p-3 text-xs text-amber-950">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-sky-600" />
                <p className="m-0 leading-relaxed">
                  El enlace muestra únicamente esta partida y su APU. Caduca en 30 días.
                </p>
              </div>
            </div>
          )}

          <div className="mt-auto flex shrink-0 items-center justify-end border-t border-amber-600/15 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-white/40"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
