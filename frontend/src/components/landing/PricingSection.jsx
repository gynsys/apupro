import React from 'react';
import { Check } from 'lucide-react';

// Ajusta aquí el precio y los créditos del plan IA sin tocar el diseño.
const AI_MONTHLY_PRICE = '9.99';
const AI_MONTHLY_CREDITS = '30';

export default function PricingSection({ onRegisterClick }) {
  const plans = [
    {
      name: 'Free',
      price: '0',
      priceSuffix: '',
      description: 'Gestiona tus obras y presupuestos sin usar IA.',
      features: [
        '15.712 partidas COVENIN',
        'Presupuestos manuales ilimitados',
        'Creación y edición manual de APUs',
        'Cómputos métricos',
        'Control de Obra',
        'Importación y exportación Excel/PDF',
        'Varias obras',
        'Sin tarjeta de crédito',
      ],
      buttonText: 'Probar Free',
      popular: false,
    },
    {
      name: 'IA',
      price: AI_MONTHLY_PRICE,
      priceSuffix: '/mes',
      description: 'Todo lo de Free, más el trabajo que resuelve la IA.',
      features: [
        'Todo lo incluido en Free',
        'Generación de APUs con IA',
        'Auditoría de presupuestos con IA',
        'Importación desde PDF/Excel con IA',
        'Actualización de precios',
        `${AI_MONTHLY_CREDITS} créditos de IA al mes`,
        'Compra de créditos adicionales',
        'Soporte técnico',
      ],
      buttonText: 'Activar IA',
      popular: true,
    },
  ];

  return (
    <div id="pricing" className="py-24 bg-slate-900 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
            Free para gestionar. IA cuando la necesites.
          </h2>
          <p className="text-lg text-slate-400">
            Empieza sin costo y paga solo por el trabajo con Inteligencia Artificial.
            Sin suscripción obligatoria para las funciones manuales.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative flex flex-col p-8 rounded-2xl transition-all duration-300 ${
                plan.popular
                  ? 'bg-slate-800 border-2 border-[#1A6BB5] transform md:-translate-y-2 shadow-2xl shadow-[#1A6BB5]/20'
                  : 'bg-slate-800/40 border border-slate-700/50 hover:border-slate-600'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-[#1A6BB5] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Recomendado
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-400 h-10">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">
                  {plan.price === '0' ? 'Free' : `$${plan.price}`}
                </span>
                <span className="text-slate-400">{plan.priceSuffix}</span>
              </div>

              <ul className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#1A6BB5] shrink-0" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={onRegisterClick}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-colors ${
                  plan.popular
                    ? 'bg-[#1A6BB5] text-white hover:bg-[#134F8A]'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-500 mt-8 max-w-2xl mx-auto">
          El Plan Free no consume créditos de IA. Las funciones con IA del Plan IA
          consumen créditos según el trabajo realizado.
        </p>
      </div>
    </div>
  );
}
