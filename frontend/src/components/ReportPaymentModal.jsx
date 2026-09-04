import React, { useState, useContext } from 'react';
import { API_URL } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { X, Receipt, UploadCloud, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportPaymentModal({ isOpen, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useContext(AuthContext);
  const [success, setSuccess] = useState(false);
  const PLAN_PRICES = {
    'Básico': '$9.99',
    'Profesional': '$19.99',
    'Experto': '$34.99'
  };

  const [form, setForm] = useState({
    plan: 'Profesional',
    method: 'Pago Movil',
    amount: '$19.99',
    reference: '',
    file: null
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.reference || !form.file) {
      toast.error('Por favor ingresa el número de referencia y adjunta el comprobante.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('plan', form.plan);
      formData.append('method', form.method);
      formData.append('amount', form.amount);
      formData.append('reference', form.reference);
      formData.append('file', form.file);

      const response = await fetch(`${API_URL}/payments/report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error al enviar el reporte');
      }

      setSuccess(true);
      toast.success('¡Pago reportado exitosamente!');
    } catch (err) {
      toast.error('Ocurrió un error al reportar el pago.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-amber-600/15 overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado con estilo del modal de impresión */}
        <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
          <div className="flex items-center gap-2.5">
            <Receipt className="text-sky-600" size={22} />
            <div>
              <h2 className="m-0 text-xl font-bold text-amber-900 leading-tight">Reportar Pago</h2>
              <p className="text-xs text-amber-800/80 m-0">Sube tu comprobante para activar tu plan</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1"
          >
            <X size={22} />
          </button>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-3.5">
            <div>
              <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide block mb-1">
                Plan a activar
              </label>
              <select 
                value={form.plan}
                onChange={(e) => setForm({...form, plan: e.target.value, amount: PLAN_PRICES[e.target.value] || form.amount})}
                className="w-full px-3.5 py-2 border border-sky-200 rounded-xl text-xs text-slate-800 bg-white outline-none focus:border-sky-600 focus:bg-sky-50/50 focus:ring-4 focus:ring-sky-700/10 shadow-sm font-semibold"
              >
                <option value="Básico">Plan Básico ($9.99)</option>
                <option value="Profesional">Plan Profesional ($19.99)</option>
                <option value="Experto">Plan Experto ($34.99)</option>
              </select>
            </div>

            <div>
              <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide block mb-1">
                Método de Pago
              </label>
              <select 
                value={form.method}
                onChange={(e) => setForm({...form, method: e.target.value})}
                className="w-full px-3.5 py-2 border border-sky-200 rounded-xl text-xs text-slate-800 bg-white outline-none focus:border-sky-600 focus:bg-sky-50/50 focus:ring-4 focus:ring-sky-700/10 shadow-sm font-semibold"
              >
                <option value="Pago Movil">Pago Móvil (BDV)</option>
                <option value="Transferencia">Transferencia (BDV)</option>
                <option value="Binance">Binance (USDT)</option>
              </select>
            </div>

            <div>
              <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide block mb-1">
                Monto Pagado
              </label>
              <input 
                type="text"
                placeholder="Ej: $19.99 o Bs. 1.250"
                value={form.amount}
                onChange={(e) => setForm({...form, amount: e.target.value})}
                className="w-full px-3.5 py-2 border border-sky-200 rounded-xl text-xs text-slate-800 bg-white placeholder:text-slate-400 outline-none focus:border-sky-600 focus:bg-sky-50/50 focus:ring-4 focus:ring-sky-700/10 shadow-sm font-semibold"
              />
            </div>

            <div>
              <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide block mb-1">
                Número de Referencia
              </label>
              <input 
                type="text"
                placeholder="Ej: 123456789"
                value={form.reference}
                onChange={(e) => setForm({...form, reference: e.target.value})}
                className="w-full px-3.5 py-2 border border-sky-200 rounded-xl text-xs text-slate-800 bg-white placeholder:text-slate-400 outline-none focus:border-sky-600 focus:bg-sky-50/50 focus:ring-4 focus:ring-sky-700/10 shadow-sm font-semibold"
              />
            </div>

            <div>
              <label className="text-[13px] font-bold text-amber-900 uppercase tracking-wide block mb-1">
                Comprobante (Imagen o PDF)
              </label>
              <div className="relative border-2 border-dashed border-sky-200 rounded-xl p-3.5 text-center bg-white/60 hover:bg-sky-50/50 hover:border-sky-500 transition-all cursor-pointer group">
                <input 
                  type="file" 
                  accept="image/*,.pdf"
                  onChange={(e) => setForm({...form, file: e.target.files[0]})}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-1.5">
                  <UploadCloud size={24} className={form.file ? "text-sky-600" : "text-sky-400 group-hover:text-sky-600"} />
                  <span className="text-xs font-semibold text-sky-800">
                    {form.file ? form.file.name : "Haz clic o arrastra tu archivo aquí"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-amber-600/15 mt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="bg-transparent border-none text-amber-700 text-sm font-semibold px-4 py-2 cursor-pointer rounded-xl hover:bg-white/40 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 px-6 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={36} />
            </div>
            <h2 className="text-2xl font-bold text-amber-950 mb-2">¡Reporte Enviado!</h2>
            <p className="text-amber-900/80 mb-6 text-xs leading-relaxed max-w-xs mx-auto">
              Hemos recibido tu comprobante de pago exitosamente. Nuestro equipo lo verificará y activará tu plan en breve.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
