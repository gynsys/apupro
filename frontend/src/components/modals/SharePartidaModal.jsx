import React, { useEffect, useState } from 'react';
import { Check, Copy, Globe, Loader2, Search, Send, Share2, ShieldCheck, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';

export default function SharePartidaModal({ isOpen, onClose, budget, item }) {
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
    if (isOpen && budget?.id && item?.id) {
      setShareData(null);
      setCopied(false);
      setUserQuery('');
      setUserResults([]);
      setRecipient(null);
      setNote('');
      generateLink();
    }
  }, [isOpen, budget?.id, item?.id]);

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
      if (!res.ok) throw new Error('No se pudo generar el enlace');
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

  const handleSendToUser = async () => {
    if (!recipient) {
      toast.error('Selecciona un usuario');
      return;
    }
    setSending(true);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers.Authorization = `Bearer ${storedToken}`;
      const res = await fetch(`${API_URL}/cost360/custom-apus/share`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          recipient_id: recipient.id,
          budget_id: budget.id,
          item_id: item.id,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'No se pudo enviar la partida');
      toast.success(`APU enviado a ${recipient.full_name || recipient.username || recipient.email}`);
      onClose();
    } catch (error) {
      toast.error(error.message || 'No se pudo enviar la partida');
    } finally {
      setSending(false);
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
            <h3 className="mt-0.5 truncate text-base font-bold text-amber-950">{item?.description || 'Partida'}</h3>
            <p className="mt-1 text-xs text-slate-600">{budget?.name || budget?.project_name || 'Presupuesto'}</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-amber-900">
              <Globe size={15} className="text-sky-600" /> Enlace público
            </label>
            {loading ? (
              <div className="py-2 text-center text-xs text-amber-900/70">Generando enlace...</div>
            ) : (
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="min-w-0 flex-1 rounded-xl border border-sky-200 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-800 outline-none select-all focus:border-sky-600 focus:bg-sky-50/50 focus:ring-4 focus:ring-sky-700/10"
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
            )}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-600/15 bg-white/50 p-3 text-xs text-amber-950">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-sky-600" />
              <p className="m-0 leading-relaxed">El enlace muestra únicamente esta partida y su APU. Caduca en 30 días.</p>
            </div>
          </div>

          <div className="border-t border-amber-600/20 pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-amber-900">
              <UserPlus size={15} className="text-sky-600" /> Enviar a un usuario
            </div>
            <p className="mb-2 text-xs text-amber-800/80">
              Se copiará en su base <strong>Compartidos conmigo</strong>.
            </p>

            {recipient ? (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-emerald-900">{recipient.full_name || recipient.username}</p>
                  <p className="truncate text-[10px] text-emerald-700">{recipient.email}</p>
                </div>
                <button type="button" onClick={() => setRecipient(null)} className="text-xs font-semibold text-emerald-700">
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2.5">
                  <Search size={15} className="text-slate-400" />
                  <input
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Buscar por correo, usuario o nombre..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none"
                  />
                  {searchingUsers && <Loader2 size={14} className="animate-spin text-sky-600" />}
                </div>
                {userResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    {userResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => { setRecipient(user); setUserResults([]); setUserQuery(''); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-sky-50"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">
                          {(user.full_name || user.username || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">{user.full_name || user.username}</p>
                          <p className="truncate text-[10px] text-slate-400">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Nota opcional: revisa este APU, actualicé los precios..."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500"
            />

            <button
              type="button"
              onClick={handleSendToUser}
              disabled={!recipient || sending}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enviar a Compartidos conmigo
            </button>
          </div>

          <div className="mt-auto flex shrink-0 items-center justify-end border-t border-amber-600/15 pt-3">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-white/40">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
