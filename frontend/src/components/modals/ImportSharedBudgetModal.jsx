import React, { useState, useEffect } from 'react';
import { Link2, X, Download, Loader2, AlertCircle, CheckCircle2, User, Layers, DollarSign, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../../services/api';

export default function ImportSharedBudgetModal({ isOpen, onClose, onSuccess }) {
  const [inputValue, setInputValue] = useState('');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setPreview(null);
      setError(null);
      setLoadingPreview(false);
      setImporting(false);
    }
  }, [isOpen]);

  const extractToken = (text) => {
    if (!text) return '';
    const trimmed = text.trim();
    const match = trimmed.match(/cb_[a-zA-Z0-9_-]+/);
    return match ? match[0] : '';
  };

  const handleConsult = async (tokenToFetch) => {
    const token = tokenToFetch || extractToken(inputValue);
    if (!token) {
      setError('Por favor ingresa un enlace o código de presupuesto válido.');
      return;
    }

    setLoadingPreview(true);
    setError(null);
    setPreview(null);

    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/budgets/shared/${token}`, {
        headers,
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else if (res.status === 404) {
        setError('El presupuesto no fue encontrado o el enlace ha sido desactivado por su creador.');
      } else {
        setError('Error al consultar el presupuesto compartido.');
      }
    } catch (err) {
      console.error('Error fetching shared budget preview:', err);
      setError('Error de conexión al consultar el enlace.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setError(null);
    const token = extractToken(val);
    if (token && token.startsWith('cb_') && token.length >= 10) {
      handleConsult(token);
    }
  };

  const handleImport = async () => {
    const token = extractToken(inputValue);
    if (!token) return;

    setImporting(true);
    try {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(`${API_URL}/budgets/shared/${token}/import`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('¡Presupuesto importado exitosamente!');
        onClose();
        if (onSuccess) onSuccess(data.budget_id);
      } else {
        toast.error(data.detail || 'No se pudo importar el presupuesto');
      }
    } catch (err) {
      console.error('Error importing budget from modal:', err);
      toast.error('Error al procesar la importación');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-amber-600/15 overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado con estilo del modal de impresión */}
        <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
          <div className="flex items-center gap-2.5">
            <Link2 className="text-sky-600" size={22} />
            <div>
              <h2 className="m-0 text-xl font-bold text-amber-900 leading-tight">Importar con Enlace</h2>
              <p className="text-xs text-amber-800/80 m-0">Pega el link que te compartió un compañero</p>
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
          
          {/* Campo para ingresar el link */}
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
              Enlace o Código Compartido
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                placeholder="https://www.costbase.net/budgets/shared/cb_... o cb_..."
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConsult();
                  }
                }}
                className="flex-1 px-3.5 py-2.5 border border-sky-200 rounded-xl text-xs text-slate-800 bg-white placeholder:text-slate-400 outline-none focus:border-sky-600 focus:bg-sky-50/50 focus:ring-4 focus:ring-sky-700/10 shadow-sm"
              />
              <button
                type="button"
                onClick={() => handleConsult()}
                disabled={loadingPreview || !inputValue.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-all shadow-[0_4px_6px_rgba(2,132,199,0.2)] hover:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPreview ? <Loader2 size={16} className="animate-spin" /> : 'Consultar'}
              </button>
            </div>
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Tarjeta de Vista Previa encontrada */}
          {preview && (
            <div className="bg-white/60 border border-amber-600/15 rounded-xl p-4 shadow-sm space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-amber-600/15 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/70 block">
                    Presupuesto Detectado
                  </span>
                  <h3 className="text-base font-bold text-amber-950 mt-0.5 truncate max-w-sm">
                    {preview.name}
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <User size={16} />
                </div>
              </div>

              {/* Métricas del proyecto */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white/80 p-2 rounded-xl border border-amber-600/15">
                  <span className="text-[10px] text-slate-500 block">Emisor</span>
                  <span className="font-semibold text-amber-950 truncate block text-[11px]">{preview.owner_name}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-amber-600/15">
                  <span className="text-[10px] text-slate-500 block">Partidas</span>
                  <span className="font-bold text-slate-800 block text-xs">{preview.items_count}</span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-amber-600/15">
                  <span className="text-[10px] text-slate-500 block">Monto</span>
                  <span className="font-bold text-sky-700 block text-xs truncate">
                    {preview.currency === 'USD' ? '$' : 'Bs.'}{' '}
                    {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(preview.total_amount)}
                  </span>
                </div>
              </div>

              {/* Botón de importación */}
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-[0_4px_6px_rgba(2,132,199,0.2)] hover:-translate-y-[1px] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Importando a tu cuenta...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Clonar e Importar a Mis Presupuestos</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer modal */}
          <div className="flex items-center justify-end pt-3 border-t border-amber-600/15">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border-none text-amber-700 text-sm font-semibold px-5 py-2 cursor-pointer rounded-xl hover:bg-white/40 transition-colors"
            >
              Cancelar
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
