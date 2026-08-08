import React from 'react';
import { Database, Zap, FileSpreadsheet, Bot, Network, ShieldCheck } from 'lucide-react';

const features = [
  {
    icon: <Bot className="w-8 h-8 text-blue-500" />,
    title: 'Generación con IA',
    description: 'Describe el concepto de tu partida y nuestra inteligencia artificial buscará los insumos más adecuados para crear un APU inicial.'
  },
  {
    icon: <Database className="w-8 h-8 text-indigo-500" />,
    title: 'Base de Datos Maestra',
    description: 'Accede a miles de materiales, equipos y mano de obra actualizados. Clona y personaliza bases para cada proyecto.'
  },
  {
    icon: <FileSpreadsheet className="w-6 h-6" />,
    title: 'Exportación a PDF / Excel',
    description: 'Genera reportes impecables listos para licitaciones o exporta al formato tradicional BC3 y Excel sin fricciones.'
  },
  {
    icon: <Zap className="w-8 h-8 text-amber-500" />,
    title: 'Cálculo en Tiempo Real',
    description: 'Cambia un factor de costos, rendimientos o cantidades y mira cómo se actualiza todo tu presupuesto instantáneamente.'
  },
  {
    icon: <Network className="w-8 h-8 text-purple-500" />,
    title: 'Gestión por Capítulos',
    description: 'Estructura tus presupuestos con jerarquías claras. Capítulos, subcapítulos y partidas bajo un control absoluto.'
  },
  {
    icon: <ShieldCheck className="w-8 h-8 text-rose-500" />,
    title: 'Seguridad en la Nube',
    description: 'Tus presupuestos respaldados en servidores seguros. Accede desde cualquier dispositivo sin instalar software antiguo.'
  }
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-slate-900 relative">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Herramientas para la <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Construcción Moderna</span>
          </h2>
          <p className="text-slate-400 text-lg">
            Olvídate de las hojas de cálculo frágiles y el software desactualizado. CostBase ofrece una experiencia fluida, rápida y potente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feat, index) => (
            <div key={index} className="p-8 rounded-3xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors duration-300 group">
              <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-slate-800">
                {feat.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feat.title}</h3>
              <p className="text-slate-400 leading-relaxed">
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
