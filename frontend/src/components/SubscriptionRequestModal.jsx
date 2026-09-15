import React, { useState } from 'react';
import { API_URL } from '../services/api';
import { X, Crown, CheckCircle } from 'lucide-react';
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-md bg-amber-100 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border sm:border-amber-600/15 overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 pt-safe bg-white/40 border-b border-amber-600/15 shrink-0">
          <div className="flex items-center gap-2.5">
            <Crown className="text-sky-600 shrink-0" size={22} />
            <div>
              <h2 className="m-0 text-lg sm:text-xl font-bold text-amber-900 leading-tight">Actualiza tu Plan</h2>
              <p className="text-xs text-amber-800/80 m-0">Elige la opción que mejor se adapte a ti</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-amber-700 hover:text-amber-900 p-2 touch-target flex items-center justify-center rounded-xl hover:bg-amber-200/50 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {!success ? (
          <div className="px-4 sm:px-6 py-4 flex-1 overflow-y-auto flex flex-col gap-4">
            {/* Mensaje de límite */}
            <div className="p-3 bg-white/50 border border-amber-600/15 rounded-xl text-xs text-amber-950 font-medium">
              {getMessage()}
            </div>

            <div className="text-center my-1">
              <h3 className="font-bold text-amber-900 text-base mb-0.5">
                Selecciona el plan que deseas solicitar:
              </h3>
              <p className="text-xs text-amber-800/80">Un asesor te contactará para activar tu cuenta.</p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleRequest('Básico')}
                disabled={isSubmitting}
                className={`w-full py-3 px-4 bg-white/80 hover:bg-white text-slate-800 font-semibold rounded-xl transition-all border border-amber-600/20 hover:border-sky-300 shadow-sm flex justify-between items-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-[1px] active:scale-[0.99]'}`}
              >
                <span className="flex items-center gap-2 text-sm">🚀 Plan Básico</span>
                <span className="text-xs font-bold text-slate-600 bg-amber-50/80 px-2 py-1 rounded-md border border-amber-600/10">$9.99 / mes</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleRequest('Profesional')}
                disabled={isSubmitting}
                className={`w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-[0_4px_6px_rgba(2,132,199,0.25)] transition-all flex justify-between items-center border border-sky-500 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-[1px] active:scale-[0.99]'}`}
              >
                <span className="flex items-center gap-2 text-sm font-bold">⭐ Plan Profesional</span>
                <span className="text-xs font-bold text-sky-100 bg-sky-700/60 px-2 py-1 rounded-md">$19.99 / mes</span>
              </button>

              <button
                type="button"
                onClick={() => handleRequest('Experto')}
                disabled={isSubmitting}
                className={`w-full py-3 px-4 bg-white/80 hover:bg-white text-slate-800 font-semibold rounded-xl transition-all border border-amber-600/20 hover:border-sky-300 shadow-sm flex justify-between items-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-[1px] active:scale-[0.99]'}`}
              >
                <span className="flex items-center gap-2 text-sm">👑 Plan Experto</span>
                <span className="text-xs font-bold text-slate-600 bg-amber-50/80 px-2 py-1 rounded-md border border-amber-600/10">$34.99 / mes</span>
              </button>
            </div>

            <div className="flex items-center justify-end pt-3 pb-safe border-t border-amber-600/15 mt-auto shrink-0">
              <button 
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="bg-transparent border-none text-amber-700 text-sm font-semibold px-5 py-2.5 touch-target flex items-center justify-center cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 text-center flex flex-col items-center justify-center flex-1 pb-safe">
            <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={36} />
            </div>
            <h2 className="text-xl font-bold text-amber-950 mb-2">¡Excelente Elección!</h2>
            <p className="text-sm text-amber-900/80 mb-6 leading-relaxed">
              Hemos registrado tu interés por el <strong>Plan {selectedPlan}</strong>. Un asesor de CostBase se pondrá en contacto contigo muy pronto para activarlo.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 touch-target bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
