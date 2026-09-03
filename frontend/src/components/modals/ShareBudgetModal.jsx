import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, X, Globe, ShieldCheck, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';

export default function ShareBudgetModal({ isOpen, onClose, budget }) {
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

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

  const handleRevoke = async () => {
    if (!confirm('¿Deseas revocar este enlace? Quienes lo tengan ya no podrán importar el presupuesto.')) return;
    setRevoking(true);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/budgets/${budget.id}/share`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      if (res.ok) {
        toast.success('Enlace de compartición revocado');
        onClose();
      } else {
        toast.error('Error al revocar enlace');
      }
    } catch (err) {
      console.error('Error revoking share link:', err);
      toast.error('Error al revocar enlace');
    } finally {
      setRevoking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-amber-50/95 border-2 border-amber-400 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado con paleta ámbar */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center justify-between text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-700/30 rounded-xl">
              <Share2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Compartir Presupuesto</h2>
              <p className="text-xs text-amber-100">Portabilidad y clonación rápida en la nube</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-amber-100 hover:text-white p-1 rounded-lg hover:bg-amber-700/30 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-5">
          {/* Tarjeta del proyecto en tonos ámbar */}
          <div className="bg-white/90 border border-amber-200 rounded-xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800/70 block">
              Proyecto a Compartir
            </span>
            <h3 className="text-base font-bold text-amber-900 mt-0.5 truncate">
              {budget?.name}
            </h3>
            {budget?.client_name && (
              <p className="text-xs text-slate-500 mt-1">
                Cliente: <span className="font-medium text-slate-700">{budget.client_name}</span>
              </p>
            )}
          </div>

          {/* Estado de carga o Enlace */}
          {loading ? (
            <div className="py-8 text-center text-amber-800/70 text-sm animate-pulse">
              Generando enlace seguro en la nube...
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Globe size={14} className="text-amber-600" />
                Enlace Único de Importación
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getFullShareUrl()}
                  className="flex-1 bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono select-all focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                    copied 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20 active:scale-95'
                  }`}
                  title="Copiar enlace"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>

              {/* Banner informativo */}
              <div className="flex items-start gap-2.5 bg-amber-100/70 border border-amber-300/80 rounded-xl p-3 text-xs text-amber-950">
                <ShieldCheck size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Cualquier compañero de oficina que tenga este enlace podrá <strong>importar y clonar</strong> una copia exacta e independiente en su propia cuenta de CostBase con un solo clic.
                </p>
              </div>
            </div>
          )}

          {/* Botones de acción inferior */}
          <div className="flex items-center justify-between pt-2 border-t border-amber-200">
            {shareData?.is_public_share && (
              <button
                type="button"
                onClick={handleRevoke}
                disabled={revoking}
                className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 size={14} />
                {revoking ? 'Revocando...' : 'Desactivar Enlace'}
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold px-4 py-2 text-slate-600 hover:bg-amber-100/60 rounded-xl transition-colors"
              >
                Cerrar
              </button>
              {getFullShareUrl() && (
                <a
                  href={getFullShareUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-3.5 py-2 rounded-xl transition-colors"
                >
                  <ExternalLink size={14} />
                  Ver Vista Previa
                </a>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
