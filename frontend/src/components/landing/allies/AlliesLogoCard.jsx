import React, { useState } from 'react';
import { ExternalLink, Building2 } from 'lucide-react';
import { API_URL } from '../../../services/api';

export default function AlliesLogoCard({ ally }) {
  const [imageError, setImageError] = useState(false);

  // Normalizar la URL del logo: si es relativa (/uploads o /images), asegurar ruta correcta
  const getFullLogoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `${API_URL.replace('/api/v1', '')}${url}`;
    }
    return url;
  };

  const logoSrc = getFullLogoUrl(ally.logo_url);

  const CardContent = (
    <div className="group relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-white/95 hover:bg-white border border-slate-200/80 shadow-md hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-1 w-[220px] sm:w-[250px] h-[130px] sm:h-[140px] select-none shrink-0">
      {/* Contenedor del Logo */}
      <div className="w-full h-16 sm:h-20 flex items-center justify-center p-2 overflow-hidden">
        {!imageError && logoSrc ? (
          <img
            src={logoSrc}
            alt={ally.name}
            onError={() => setImageError(true)}
            className="max-h-full max-w-full object-contain filter drop-shadow-xs transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
            <Building2 size={22} className="text-blue-600 shrink-0" />
            <span className="truncate max-w-[150px]">{ally.name}</span>
          </div>
        )}
      </div>

      {/* Nombre y categoría */}
      <div className="w-full mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700 truncate max-w-[170px]" title={ally.name}>
          {ally.name}
        </span>
        {ally.category && (
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[9px] uppercase tracking-wider shrink-0">
            {ally.category}
          </span>
        )}
      </div>

      {/* Indicador sutil de link web */}
      {ally.website_url && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600">
          <ExternalLink size={13} />
        </div>
      )}
    </div>
  );

  if (ally.website_url) {
    return (
      <a
        href={ally.website_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-2xl cursor-pointer"
        title={`Visitar sitio web de ${ally.name}`}
      >
        {CardContent}
      </a>
    );
  }

  return CardContent;
}
