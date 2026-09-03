import React, { useState } from 'react';
import { X, Crown, Sparkles, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubscriptionRequestModal({ isOpen, onClose, limitType }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  if (!isOpen) return null;

  const handleRequest = async (planName) => {
    setSelectedPlan(planName);
    setIsSubmitting(true);
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
      const response = await fetch(`${API_URL}/users/subscription-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan_name: planName })
      });
      
      if (!response.ok) {
        throw new Error('Error al procesar solicitud');
      }
      
      setSuccess(true);
      toast.success('¡Solicitud enviada! Nuestro equipo te contactará.');
    } catch (error) {
      toast.error('Ocurrió un error. Por favor intenta de nuevo.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMessage = () => {
    if (limitType === 'database') {
      return 'Has alcanzado el límite de bases de datos personalizadas de tu cuenta demo.';
    }
    if (limitType === 'apu') {
      return 'Has alcanzado el límite de generación de APUs con Inteligencia Artificial de tu cuenta demo.';
    }
    if (limitType === 'manual') {
      return 'Actualiza tu plan hoy para desbloquear herramientas avanzadas y quitar todos los límites.';
    }
    return 'Has alcanzado el límite de tu cuenta demo.';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
          disabled={isSubmitting}
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
              <div className="mb-6 text-center">
                <h3 className="font-bold text-slate-800 text-lg mb-1">
                  Selecciona el plan que deseas solicitar:
                </h3>
                <p className="text-sm text-slate-500">Un asesor te contactará para activar tu cuenta.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleRequest('Básico')}
                  disabled={isSubmitting}
                  className={`w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all border border-slate-200 flex justify-between items-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
                >
                  <span className="flex items-center gap-2">🚀 Plan Básico</span>
                  <span className="text-slate-500">$9.99 / mes</span>
                </button>
                
                <button
                  onClick={() => handleRequest('Profesional')}
                  disabled={isSubmitting}
                  className={`w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all flex justify-between items-center border border-blue-500 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
                >
                  <span className="flex items-center gap-2">⭐ Plan Profesional</span>
                  <span className="text-blue-100">$19.99 / mes</span>
                </button>

                <button
                  onClick={() => handleRequest('Experto')}
                  disabled={isSubmitting}
                  className={`w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all flex justify-between items-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
                >
                  <span className="flex items-center gap-2">👑 Plan Experto</span>
                  <span className="text-slate-400">$34.99 / mes</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Excelente Elección!</h2>
            <p className="text-slate-600 mb-8">
              Hemos registrado tu interés por el <strong>Plan {selectedPlan}</strong>. Un asesor de CostBase se pondrá en contacto contigo muy pronto para activarlo.
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
