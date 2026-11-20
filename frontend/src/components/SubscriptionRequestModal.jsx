import React, { useState } from 'react';
import { API_URL } from '../services/api';
import { X, Crown, CheckCircle, Check, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const AI_PLAN_FEATURES = [
  'Generador de APU con Inteligencia Artificial (30 APUs/mes)',
  'Auditoría de presupuestos con IA',
  'Importación desde PDF y Excel con IA',
  'Actualización de precios con bases históricas',
  'Compra de APUs adicionales y soporte técnico',
];

export default function SubscriptionRequestModal({ isOpen, onClose, limitType }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  if (!isOpen) return null;

  const handleRequest = async (planName = 'Plan IA') => {
    setSelectedPlan(planName);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/users/subscription-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan_name: planName }),
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
      return 'Activa el Plan IA para desbloquear herramientas avanzadas y bases personalizadas.';
    }
    if (limitType === 'apu') {
      return 'Has alcanzado el límite de 3 APUs gratuitos con Inteligencia Artificial. Activa el Plan IA para seguir generando APUs y usar las herramientas con IA.';
    }
    return 'Activa el Plan IA para desbloquear todas las funciones con Inteligencia Artificial.';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-md bg-amber-100 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border sm:border-amber-600/15 overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Encabezado */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 pt-safe bg-white/40 border-b border-amber-600/15 shrink-0">
          <div className="flex items-center gap-2.5">
            <Crown className="text-sky-600 shrink-0" size={22} />
            <div>
              <h2 className="m-0 text-lg sm:text-xl font-bold text-amber-900 leading-tight">Activa el Plan IA</h2>
              <p className="text-xs text-amber-800/80 m-0">Paga solo por las funciones con Inteligencia Artificial</p>
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
            <div className="p-3 bg-white/60 border border-amber-600/15 rounded-xl text-xs text-amber-950 font-medium leading-relaxed">
              {getMessage()}
            </div>

            <div className="rounded-2xl border-2 border-sky-500/80 bg-white/90 p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight">Plan IA</h3>
                    <p className="text-[11px] text-slate-500">Todos los servicios pagos con IA</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-sky-700">$9.99</span>
                  <span className="text-xs font-semibold text-slate-500"> / mes</span>
                </div>
              </div>

              <ul className="space-y-2 border-t border-slate-100 pt-3">
                {AI_PLAN_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-slate-700">
                    <Check size={14} className="text-sky-600 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleRequest('Plan IA')}
                disabled={isSubmitting}
                className={`w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl shadow-[0_4px_6px_rgba(2,132,199,0.25)] transition-all flex justify-center items-center gap-2 cursor-pointer ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-[1px] active:scale-[0.99]'
                }`}
              >
                <Sparkles size={16} />
                <span>{isSubmitting ? 'Enviando solicitud...' : 'Solicitar Plan IA ($9.99 / mes)'}</span>
              </button>
            </div>

            <div className="flex items-center justify-end pt-2 pb-safe border-t border-amber-600/15 mt-auto shrink-0">
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
              Hemos registrado tu solicitud para el <strong>{selectedPlan}</strong>. Un asesor de Kostos360 se pondrá en contacto contigo muy pronto para activarlo.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-4 touch-target bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
