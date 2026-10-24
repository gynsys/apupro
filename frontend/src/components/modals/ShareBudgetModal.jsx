import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, X, Globe, ShieldCheck, Search, Send, UserPlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';

export default function ShareBudgetModal({ isOpen, onClose, budget }) {
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
    if (isOpen && budget?.id) {
      handleGenerateShareLink();
      setUserQuery('');
      setUserResults([]);
      setRecipient(null);
      setNote('');
    } else {
      setShareData(null);
      setCopied(false);
    }
  }, [isOpen, budget?.id]);

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
      const res = await fetch(`${API_URL}/budgets/${budget.id}/share-to-user`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          recipient_id: recipient.id,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'No se pudo compartir el presupuesto');
      toast.success(`Presupuesto enviado a ${recipient.full_name || recipient.username || recipient.email}`);
      onClose();
    } catch (error) {
      toast.error(error.message || 'No se pudo compartir el presupuesto');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-lg bg-amber-100 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border sm:border-amber-600/15 overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado con estilo del modal de impresión */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 pt-safe bg-white/40 border-b border-amber-600/15 shrink-0">
          <div className="flex items-center gap-2.5">
            <Share2 className="text-sky-600 shrink-0" size={20} />
            <div>
              <h2 className="m-0 text-lg sm:text-xl font-bold text-amber-900 leading-tight">Compartir Presupuesto</h2>
              <p className="text-xs text-amber-800/80 m-0">Portabilidad y clonación rápida en la nube</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-amber-700 hover:text-amber-900 p-2 touch-target flex items-center justify-center rounded-xl hover:bg-amber-200/50 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido del modal */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto flex flex-col gap-4">
          {/* Card resumen del presupuesto */}
          <div className="bg-white/60 border border-amber-600/20 rounded-xl p-4 shadow-sm">
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

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getFullShareUrl()}
                  className="flex-1 px-3.5 py-2.5 border border-sky-200 rounded-xl text-xs text-slate-800 font-mono bg-white outline-none select-all focus:border-sky-600 focus:bg-sky-50/50 focus:ring-4 focus:ring-sky-700/10 shadow-sm"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-[0_4px_6px_rgba(2,132,199,0.2)] active:scale-95 min-h-[40px] touch-target cursor-pointer ${
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

          {/* Enviar a un usuario */}
          <div className="border-t border-amber-600/15 pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-amber-900">
              <UserPlus size={15} className="text-sky-600" /> Enviar a un usuario
            </div>
            <p className="mb-2 text-xs text-amber-800/80">
              Recibirá una notificación con el enlace para importarlo a sus presupuestos.
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
              placeholder="Nota opcional para el destinatario..."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500"
            />

            <button
              type="button"
              onClick={handleSendToUser}
              disabled={!recipient || sending}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enviar presupuesto
            </button>
          </div>

          {/* Footer del modal: solo botón Cerrar */}
          <div className="flex items-center justify-end pt-3 pb-safe border-t border-amber-600/15 mt-auto shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border-none text-amber-700 text-sm font-semibold px-5 py-2.5 touch-target flex items-center justify-center cursor-pointer rounded-xl hover:bg-white/40 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
