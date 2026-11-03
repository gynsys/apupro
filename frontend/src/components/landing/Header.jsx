import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header({ onLoginClick }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 pt-safe transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 shadow-lg shadow-black/20'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo Section */}
          <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo-cb-new.png" alt="CostBase Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
            <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Cost<span className="text-blue-500">Base</span>
            </span>
          </div>

          {/* Navigation / Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
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
              className="px-3 sm:px-5 h-[30px] sm:h-auto min-h-[30px] sm:min-h-[40px] py-1 sm:py-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-300 shadow-[0_0_15px_-5px_rgba(37,99,235,0.5)] flex items-center justify-center cursor-pointer"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
