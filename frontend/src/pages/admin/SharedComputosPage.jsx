import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Calendar, Download, Layers, Loader2, LogIn, Share2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import LoginModal from '../../components/landing/LoginModal';

export default function SharedComputosPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useContext(AuthContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
        const headers = {};
        if (storedToken) headers.Authorization = `Bearer ${storedToken}`;
        const res = await fetch(`${API_URL}/budgets/computos/shared/${token}`, {
          headers,
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? 'El enlace de esta planilla ha caducado o ya no está disponible.'
              : 'No se pudo cargar la planilla compartida.'
          );
        }
        const payload = await res.json();
        if (active) setData(payload);
      } catch (err) {
        if (active) setError(err.message || 'Error al cargar la planilla compartida');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [token]);

  const handleImport = async () => {
    if (!token) return;
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setImporting(true);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;
      const res = await fetch(`${API_URL}/budgets/computos/shared/${token}/import`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        toast.error(result.detail || 'No se pudo importar la planilla');
        return;
      }
      toast.success('Planilla importada a tus Cómputos Guardados');
      navigate('/budgets');
    } catch {
      toast.error('Error de conexión al importar la planilla');
    } finally {
      setImporting(false);
    }
  };

  const draft = data?.draft;
  const items = Array.isArray(draft?.items) ? draft.items : [];

  return (
    <div className="min-h-screen bg-slate-100 pb-12 px-4 pt-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <button
          type="button"
          onClick={() => navigate('/budgets')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
          Volver a Mis Presupuestos
        </button>

        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center gap-3">
            <Loader2 size={34} className="text-amber-500 animate-spin" />
            <p className="text-sm text-slate-600 font-medium">Cargando planilla de cómputos...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-red-200 shadow-sm space-y-4">
            <AlertCircle size={36} className="text-red-500 mx-auto" />
            <h1 className="text-lg font-bold text-slate-800">Planilla no disponible</h1>
            <p className="text-sm text-slate-500">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/budgets')}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold cursor-pointer"
            >
              Ir a Kostos360
            </button>
          </div>
        ) : draft ? (
          <div className="bg-white rounded-3xl border border-amber-300/60 shadow-lg overflow-hidden">
            <div className="bg-amber-100/90 border-b border-amber-300/60 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-white/70 px-2.5 py-0.5 rounded-full border border-amber-300 mb-2">
                  <Share2 size={12} /> Planilla de Cómputos Compartida
                </span>
                <h1 className="text-xl font-extrabold text-amber-950 truncate">{draft.budgetName}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-amber-900/80">
                  <span className="inline-flex items-center gap-1">
                    <User size={13} /> Compartido por: <strong>{data.owner_name}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Layers size={13} /> {draft.itemCount || items.length} fila(s)
                  </span>
                  {draft.savedAt && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={13} /> {new Date(draft.savedAt).toLocaleDateString('es-VE')}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer shrink-0"
              >
                {importing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isAuthenticated ? (
                  <Download size={16} />
                ) : (
                  <LogIn size={16} />
                )}
                {importing
                  ? 'Importando...'
                  : isAuthenticated
                    ? 'Importar a mis Cómputos'
                    : 'Inicia sesión para importar'}
              </button>
            </div>

            <div className="p-6 overflow-x-auto">
              {items.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Esta planilla no tiene partidas registradas.</p>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                      <th className="p-2.5 text-left">#</th>
                      <th className="p-2.5 text-left">Código</th>
                      <th className="p-2.5 text-left">Descripción</th>
                      <th className="p-2.5 text-center">Unidad</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr
                        key={it.id || idx}
                        className={`border-b border-slate-100 ${it.isChapter ? 'bg-amber-50/70 font-bold text-amber-950' : ''}`}
                      >
                        <td className="p-2.5 text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{it.covPar || it.code || '—'}</td>
                        <td className="p-2.5 text-slate-800">{it.description || it.chapterName || '—'}</td>
                        <td className="p-2.5 text-center text-slate-600">{it.isChapter ? '—' : (it.unit || 'und')}</td>
                        <td className="p-2.5 text-right font-mono font-semibold text-slate-800">
                          {it.isChapter ? '—' : Number(it.quantity ?? it.total ?? 0).toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false);
            handleImport();
          }}
        />
      )}
    </div>
  );
}
