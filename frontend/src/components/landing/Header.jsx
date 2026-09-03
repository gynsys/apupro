import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header({ onLoginClick }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo Section */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo-cb-new.png" alt="CostBase Logo" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-extrabold text-white tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Cost<span className="text-blue-500">Base</span>
            </span>
          </div>

          {/* Navigation / Actions */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="hidden sm:block px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Funciones
            </button>
            <button 
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="hidden sm:block px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Planes
            </button>
            <button 
              onClick={onLoginClick}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-300 shadow-[0_0_15px_-5px_rgba(37,99,235,0.5)]"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
