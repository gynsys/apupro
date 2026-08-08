import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white min-h-screen flex items-center pt-20">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/30 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[100px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8 animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-300">El nuevo estándar en Análisis de Precios Unitarios</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            Presupuestos de Obra <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Impulsados por IA
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            CostBase transforma la manera en que los profesionales de la construcción calculan, gestionan y exportan sus APUs. Precisión total, bases de datos en la nube y generación inteligente.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2"
            >
              Iniciar Sesión
              <ArrowRight size={20} />
            </button>
            <button 
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              Descubrir Funciones
            </button>
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-6 sm:gap-12 text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-blue-500" />
              <span>Base de Datos Sincronizada</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-blue-500" />
              <span>Cálculos Inmediatos</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-blue-500" />
              <span>Reportes Lulowin</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
