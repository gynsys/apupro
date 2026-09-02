import React, { useState } from 'react';
import { X, Crown, Sparkles, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubscriptionRequestModal({ isOpen, onClose, limitType }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleRequest = async () => {
    setIsSubmitting(true);
    // Simular una petición al backend o correo
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      toast.success('¡Solicitud enviada! Nuestro equipo te contactará.');
    }, 1500);
  };

  const getMessage = () => {
    if (limitType === 'database') {
      return 'Has alcanzado el límite de bases de datos personalizadas de tu cuenta gratuita.';
    }
    if (limitType === 'apu') {
      return 'Has alcanzado el límite de generación de APUs con Inteligencia Artificial.';
    }
    return 'Has alcanzado el límite de tu cuenta actual.';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
        >
          <X size={24} />
        </button>

        {!success ? (
          <>
            <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 text-[#1A6BB5] opacity-20">
                <Crown size={150} />
              </div>
              <Crown size={48} className="text-[#1A6BB5] mx-auto mb-4 relative z-10" />
              <h2 className="text-2xl font-bold text-white relative z-10 mb-2">
                Actualiza tu Plan
              </h2>
              <p className="text-slate-300 relative z-10">
                {getMessage()}
              </p>
            </div>

            <div className="p-8">
              <div className="bg-blue-50 rounded-xl p-6 mb-8 border border-blue-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <Sparkles size={18} className="text-blue-600" />
                  Beneficios Premium
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <span>Más Análisis de Precios (APU) generados por IA.</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <span>Múltiples bases de datos personalizadas.</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <span>Actualización de precios quincenal.</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleRequest}
                  disabled={isSubmitting}
                  className={`w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
                >
                  {isSubmitting ? 'Procesando...' : 'Solicitar Información del Plan'}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Solicitud Recibida!</h2>
            <p className="text-slate-600 mb-8">
              Un asesor de CostBase se pondrá en contacto contigo muy pronto para activar tu plan premium.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-[#1A6BB5] hover:bg-[#134F8A] text-white font-bold rounded-xl transition-colors"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
