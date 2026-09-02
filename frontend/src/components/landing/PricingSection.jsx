import React from 'react';
import { Check } from 'lucide-react';

export default function PricingSection({ onRegisterClick }) {
  const plans = [
    {
      name: 'Básico',
      price: '9.99',
      description: 'Ideal para profesionales independientes y proyectos pequeños.',
      features: [
        '10 APUs generados con IA por mes',
        'Actualización de precios Mensual',
        'Presupuestos manuales ilimitados',
        'Acceso a la Base de Datos Maestra',
        'Exportación a Excel y PDF',
      ],
      buttonText: 'Comenzar Básico',
      popular: false,
    },
    {
      name: 'Profesional',
      price: '19.99',
      description: 'Perfecto para contratistas con flujo constante de obras.',
      features: [
        '25 APUs generados con IA por mes',
        'Actualización de precios Quincenal',
        'Gestión de bases de datos personalizadas',
        'Todo lo incluido en el plan Básico',
        'Soporte técnico por correo',
      ],
      buttonText: 'Comenzar Profesional',
      popular: true,
    },
    {
      name: 'Experto',
      price: '34.99',
      description: 'Para empresas que requieren el máximo rendimiento y volumen.',
      features: [
        '50 APUs generados con IA por mes',
        'Actualización de precios Quincenal',
        'Máxima velocidad de procesamiento IA',
        'Herramientas avanzadas de análisis',
        'Soporte VIP prioritario',
      ],
      buttonText: 'Comenzar Experto',
      popular: false,
    },
  ];

  return (
    <div id="pricing" className="py-24 bg-slate-900 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
            Planes Transparentes y Flexibles
          </h2>
          <p className="text-lg text-slate-400">
            Paga solo por el poder de Inteligencia Artificial que necesitas. Todos los planes incluyen la gestión ilimitada de presupuestos manuales.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
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
                    Más Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-400 h-10">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                <span className="text-slate-400">/mes</span>
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
      </div>
    </div>
  );
}
