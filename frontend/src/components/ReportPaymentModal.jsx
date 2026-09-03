import React, { useState } from 'react';
import { X, Receipt, UploadCloud, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportPaymentModal({ isOpen, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useContext(AuthContext);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    plan: 'Profesional',
    method: 'Pago Movil',
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
      formData.append('reference', form.reference);
      formData.append('file', form.file);

      const response = await fetch(`${API_URL}/api/v1/payments/report`, {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
          disabled={isSubmitting}
        >
          <X size={24} />
        </button>

        {!success ? (
          <>
            <div className="bg-slate-900 p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 text-green-500 opacity-20">
                <Receipt size={120} />
              </div>
              <Receipt size={40} className="text-green-400 mx-auto mb-3 relative z-10" />
              <h2 className="text-xl font-bold text-white relative z-10">
                Reportar Pago
              </h2>
              <p className="text-slate-300 relative z-10 text-sm mt-1">
                Sube tu comprobante para activar tu plan
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Plan a activar</label>
                <select 
                  value={form.plan}
                  onChange={(e) => setForm({...form, plan: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
                >
                  <option value="Básico">Plan Básico ($9.99)</option>
                  <option value="Profesional">Plan Profesional ($19.99)</option>
                  <option value="Experto">Plan Experto ($34.99)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Método de Pago</label>
                <select 
                  value={form.method}
                  onChange={(e) => setForm({...form, method: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
                >
                  <option value="Pago Movil">Pago Móvil (BDV)</option>
                  <option value="Transferencia">Transferencia (BDV)</option>
                  <option value="Binance">Binance (USDT)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Referencia</label>
                <input 
                  type="text"
                  placeholder="Ej: 123456789"
                  value={form.reference}
                  onChange={(e) => setForm({...form, reference: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comprobante (Imagen o PDF)</label>
                <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer group">
                  <input 
                    type="file" 
                    accept="image/*,.pdf"
                    onChange={(e) => setForm({...form, file: e.target.files[0]})}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <UploadCloud size={24} className={form.file ? "text-green-500" : "text-slate-400 group-hover:text-green-500"} />
                    <span className="text-sm font-medium text-slate-600">
                      {form.file ? form.file.name : "Haz clic o arrastra tu archivo aquí"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full mt-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
              </button>
            </form>
          </>
        ) : (
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Reporte Enviado!</h2>
            <p className="text-slate-600 mb-8 text-sm">
              Hemos recibido tu comprobante de pago exitosamente. Nuestro equipo lo verificará y activará tu plan en breve.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
