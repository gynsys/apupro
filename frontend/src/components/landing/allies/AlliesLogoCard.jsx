import React, { useState } from 'react';
import { API_URL } from '../../../services/api';

export default function AlliesLogoCard({ ally }) {
  const [imageError, setImageError] = useState(false);

  // Normalizar la URL del logo: soporta rutas relativas estáticas, API de logos o subidas
  const getFullLogoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('data:')) {
      return url;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Si apunta a /uploads/... (compatibilidad hacia atrás)
    if (url.includes('/uploads/')) {
      const filename = url.split('/').pop();
      return `${API_URL}/allies/logo/${filename}`;
    }
    // Si ya apunta a la ruta de la API
    if (url.startsWith('/api/v1/')) {
      const baseHost = API_URL.replace('/api/v1', '');
      return `${baseHost}${url}`;
    }
    return url;
  };

  const logoSrc = getFullLogoUrl(ally.logo_url);

  const LogoContent = (
    <div 
      className="flex items-center justify-center px-4 sm:px-6 h-14 sm:h-16 shrink-0 select-none"
      title={ally.name}
    >
      {!imageError && logoSrc ? (
        <img
          src={logoSrc}
          alt={ally.name}
          onError={() => setImageError(true)}
          className="max-h-10 sm:max-h-13 w-auto max-w-[150px] sm:max-w-[200px] object-contain transition-transform duration-300 hover:scale-105 filter drop-shadow-2xs"
          loading="lazy"
        />
      ) : (
        <span className="text-slate-800 font-extrabold text-sm sm:text-base tracking-tight hover:text-blue-600 transition-colors">
          {ally.name}
        </span>
      )}
    </div>
  );

  if (ally.website_url) {
    return (
      <a
        href={ally.website_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block shrink-0 focus:outline-none transition-opacity hover:opacity-80 cursor-pointer"
        title={`Visitar sitio web de ${ally.name}`}
      >
        {LogoContent}
      </a>
    );
  }

  return LogoContent;
}
