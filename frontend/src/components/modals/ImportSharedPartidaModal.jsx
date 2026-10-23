import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Link2, Loader2, Plus, Search, Share2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';
import { budgetService } from '../../services/budgetService';

const extractToken = (value) => {
  const clean = String(value || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
  const marker = '/shared/partida/';
  if (clean.includes(marker)) return decodeURIComponent(clean.split(marker).pop());
  return clean;
};

export default function ImportSharedPartidaModal({ isOpen, onClose, budget, onImported }) {
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setLink('');
      setPreview(null);
      setToken('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePreview = async () => {
    const nextToken = extractToken(link);
    if (!nextToken) {
      setError('Pega el enlace de una partida compartida.');
      return;
    }
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const res = await fetch(`${API_URL}/budgets/shared/partida/${encodeURIComponent(nextToken)}`);
      if (!res.ok) throw new Error('El enlace no es válido o ha expirado.');
      const data = await res.json();
      setToken(nextToken);
      setPreview(data);
    } catch (err) {
      setError(err.message || 'No se pudo validar el enlace.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !token) return;
    setImporting(true);
    try {
      const result = await budgetService.importSharedPartida(budget.id, token);
      toast.success('Partida importada al presupuesto');
      onImported?.(result);
      onClose();
    } catch (err) {
      if (err.isLimitError) {
        setError(err.detail || 'Límite de partidas alcanzado.');
      } else {
        setError(err.message || 'No se pudo importar la partida.');
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-amber-600/15 bg-amber-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-amber-600/15 bg-white/40 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Share2 className="text-sky-600" size={20} />
            <div>
              <h2 className="text-lg font-bold leading-tight text-amber-900">De Otro Usuario</h2>
              <p className="text-xs text-amber-800/80">Pega el enlace de una partida compartida</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-amber-700 transition-colors hover:bg-amber-200/50 hover:text-amber-900"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-amber-600/20 bg-white/60 p-4">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900">
              <Link2 size={14} className="text-sky-600" /> Enlace de la partida
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={link}
                onChange={(e) => { setLink(e.target.value); setPreview(null); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePreview(); }}
                placeholder="https://costbase.net/budgets/shared/partida/..."
                className="min-w-0 flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                autoFocus
              />
              <button
                type="button"
                onClick={handlePreview}
                disabled={loading || !link.trim()}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Validar
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {preview && (
            <div className="rounded-xl border border-emerald-200 bg-white/80 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-emerald-700">
                <CheckCircle2 size={16} /> Enlace válido
              </div>
              <p className="text-sm font-bold text-slate-800">{preview.item?.description}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {preview.budget?.name} · {preview.item?.unit} · {preview.item?.materials?.length || 0} materiales
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-600">
                <span className="rounded-md bg-orange-50 px-2 py-1 text-orange-700">
                  {preview.item?.materials?.length || 0} materiales
                </span>
                <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">
                  {preview.item?.equipments?.length || 0} equipos
                </span>
                <span className="rounded-md bg-teal-50 px-2 py-1 text-teal-700">
                  {preview.item?.labors?.length || 0} mano de obra
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-amber-600/15 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-white/40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!preview || importing}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Agregar al presupuesto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
