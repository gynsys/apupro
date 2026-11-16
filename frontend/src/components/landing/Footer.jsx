import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}kosto-logo.png`} alt="Kosto Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-extrabold text-white">
              Kosto
            </span>
          </div>
          
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-blue-400 transition-colors">Términos de Servicio</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Privacidad</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Contacto</a>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-slate-800/50 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Kosto. Creado por Ingeniería Arko 360. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
