import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Share2 } from 'lucide-react';
import { API_URL } from '../../services/api';
import ApuEditorUI from '../../components/ApuEditorUI';

const noop = () => {};

export default function SharedPartidaPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/budgets/shared/partida/${token}`);
        if (!res.ok) throw new Error('El enlace no es válido o ha expirado');
        const payload = await res.json();
        if (mounted) setData(payload);
      } catch (err) {
        if (mounted) setError(err.message || 'No se pudo cargar la partida compartida');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (token) load();
    return () => { mounted = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Share2 className="mx-auto mb-3 text-slate-300" size={36} />
          <h1 className="text-lg font-bold text-slate-800">Partida no disponible</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <a href="/" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            <ArrowLeft size={16} /> Ir a CostBase
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <a href="/" className="rounded-xl border border-slate-300 bg-white p-2 text-slate-600" title="Ir a CostBase">
            <ArrowLeft size={18} />
          </a>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600">APU compartido</p>
            <h1 className="truncate text-base font-extrabold text-slate-800">
              {data.item.description}
            </h1>
            <p className="text-xs text-slate-400">{data.budget.name}</p>
          </div>
          <div className="ml-auto hidden items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 sm:flex">
            <Share2 size={14} /> Enlace de solo lectura
          </div>
        </div>
      </header>

      <main className="mx-auto mt-5 max-w-6xl px-4">
        <div className="pointer-events-none rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <ApuEditorUI
            item={data.item}
            settings={data.budget}
            onHeaderChange={noop}
            onHeaderBlur={noop}
            onComponentChange={noop}
            onComponentBlur={noop}
            onRemoveRow={noop}
            onAddBlankRow={noop}
            onAddSearchRow={noop}
            onSelectComponent={noop}
            deletingId={null}
          />
        </div>
      </main>
    </div>
  );
}
