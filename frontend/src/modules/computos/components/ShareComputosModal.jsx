import React, { useEffect, useState } from 'react';
import { Check, Copy, Globe, Loader2, Search, Send, Share2, ShieldCheck, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../../services/api';

export default function ShareComputosModal({ isOpen, onClose, draft }) {
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [recipient, setRecipient] = useState(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen && draft?.id) {
      handleGenerateShareLink();
      setUserQuery('');
      setUserResults([]);
      setRecipient(null);
      setNote('');
    } else {
      setShareData(null);
      setCopied(false);
    }
  }, [isOpen, draft?.id]);

  useEffect(() => {
    const term = userQuery.trim();
    if (term.length < 2) {
      setUserResults([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
        const headers = {};
        if (storedToken) headers.Authorization = `Bearer ${storedToken}`;
        const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(term)}`, {
          headers,
          credentials: 'include',
        });
        setUserResults(res.ok ? await res.json() : []);
      } catch {
        setUserResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [userQuery]);

  const handleGenerateShareLink = async () => {
    if (!draft?.id) return;
    setLoading(true);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/budgets/computos/drafts/${encodeURIComponent(draft.id)}/share`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        setShareData(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'No se pudo generar el enlace de la planilla');
      }
    } catch {
      toast.error('Error de conexión al generar el enlace');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareData?.share_url) return;
    navigator.clipboard.writeText(shareData.share_url);
    setCopied(true);
    toast.success('Enlace copiado al portapapeles');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSendToUser = async () => {
    if (!recipient?.id || !draft?.id) return;
    setSending(true);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;
      const res = await fetch(`${API_URL}/budgets/computos/drafts/${encodeURIComponent(draft.id)}/share-to-user`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ recipient_id: recipient.id, note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.detail || 'No se pudo compartir la planilla');
        return;
      }
      toast.success(`Planilla enviada a ${recipient.full_name || recipient.username}`);
      setRecipient(null);
      setUserQuery('');
      setNote('');
    } catch {
      toast.error('Error de conexión al compartir la planilla');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-lg bg-amber-100 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border sm:border-amber-600/15 overflow-hidden font-sans flex flex-col">
        <div className="px-6 py-4 bg-amber-100/90 border-b border-amber-600/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center">
              <Share2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-950">Compartir Planilla de Cómputos</h2>
              <p className="text-xs text-amber-900/70 truncate max-w-[260px]">
                {draft?.budgetName || 'Planilla de Cómputos'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-amber-900/60 hover:text-amber-950 hover:bg-amber-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="bg-white/80 rounded-xl p-4 border border-amber-600/20 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
              <UserPlus size={14} className="text-blue-600" />
              <span>Enviar directamente a otro usuario de Kostos</span>
            </div>
            {recipient ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{recipient.full_name || recipient.username}</p>
                  <p className="text-slate-500 truncate">@{recipient.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecipient(null)}
                  className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                  title="Cambiar usuario"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Buscar por nombre, usuario o correo..."
                  className="w-full rounded-lg border border-amber-600/20 bg-amber-50/40 pl-8 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
                {searchingUsers && (
                  <Loader2 size={14} className="animate-spin absolute right-3 top-2.5 text-amber-600" />
                )}
                {userResults.length > 0 && (
                  <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
                    {userResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setRecipient(u);
                          setUserResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{u.full_name || u.username}</p>
                          <p className="text-[11px] text-slate-500 truncate">@{u.username}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-600 shrink-0 ml-2">Seleccionar</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {recipient && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota opcional para el destinatario..."
                  maxLength={140}
                  className="w-full rounded-lg border border-amber-600/20 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleSendToUser}
                  disabled={sending}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? 'Enviando...' : 'Enviar a sus Cómputos Guardados'}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-600/15">
            <Globe className="text-emerald-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-950/80 leading-relaxed">
              <strong className="text-amber-950 block mb-0.5">Enlace para importar (30 días):</strong>
              Cualquier usuario de Kostos con este enlace podrá ver las mediciones e <strong>importar una copia independiente</strong> a sus Cómputos Guardados.
            </div>
          </div>

          {loading ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-amber-900/60">
              <Loader2 className="animate-spin text-amber-600" size={24} />
              <span className="text-xs font-medium">Generando enlace...</span>
            </div>
          ) : shareData?.share_url ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-amber-950 block">Enlace público:</label>
              <div className="flex items-center gap-2 bg-white/80 p-1.5 rounded-xl border border-amber-600/20 shadow-sm">
                <input
                  type="text"
                  readOnly
                  value={shareData.share_url}
                  className="flex-1 text-xs font-mono text-slate-700 bg-transparent px-2.5 py-1.5 outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                <ShieldCheck size={14} />
                <span>Tu planilla original permanece protegida e independiente.</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-6 py-3.5 bg-amber-100/90 border-t border-amber-600/15 flex justify-end mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-amber-950 bg-white/70 border border-amber-600/20 rounded-xl hover:bg-white transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
