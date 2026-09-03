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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-amber-50/95 border-2 border-[#B5DCB0] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado con color #B5DCB0 */}
        <div className="px-6 py-4 flex items-center justify-between shadow-sm" style={{ backgroundColor: '#B5DCB0' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/40 text-[#143d1a] rounded-xl">
              <Link2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#143d1a]">Importar con Enlace</h2>
              <p className="text-xs text-[#1e5229]">Pega el link que te compartió un compañero</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-[#1e5229] hover:text-[#0d2a13] p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-5">
          
          {/* Campo para ingresar el link */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
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
                className="flex-1 bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#B5DCB0]"
              />
              <button
                type="button"
                onClick={() => handleConsult()}
                disabled={loadingPreview || !inputValue.trim()}
                style={{ backgroundColor: '#B5DCB0' }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#143d1a] hover:brightness-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed border border-[#9ecc98]"
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
            <div className="bg-white/95 border border-amber-200 rounded-2xl p-4 shadow-sm space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                    Presupuesto Detectado
                  </span>
                  <h3 className="text-base font-bold text-amber-950 mt-0.5 truncate max-w-sm">
                    {preview.name}
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#B5DCB0]/50 text-[#143d1a] flex items-center justify-center font-bold">
                  <User size={16} />
                </div>
              </div>

              {/* Métricas del proyecto */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-200/60">
                  <span className="text-[10px] text-slate-500 block">Emisor</span>
                  <span className="font-semibold text-amber-900 truncate block text-[11px]">{preview.owner_name}</span>
                </div>
                <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-200/60">
                  <span className="text-[10px] text-slate-500 block">Partidas</span>
                  <span className="font-bold text-slate-800 block text-xs">{preview.items_count}</span>
                </div>
                <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-200/60">
                  <span className="text-[10px] text-slate-500 block">Monto</span>
                  <span className="font-bold text-emerald-700 block text-xs truncate">
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
                style={{ backgroundColor: '#B5DCB0' }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#143d1a] hover:brightness-95 border border-[#9ecc98] shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Importando a tu cuenta...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>📥 Clonar e Importar a Mis Presupuestos</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer modal */}
          <div className="flex items-center justify-end pt-2 border-t border-amber-200/80">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold px-4 py-2 text-slate-600 hover:bg-amber-100/60 rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
