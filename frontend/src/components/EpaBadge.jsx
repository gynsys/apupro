import React from 'react';
import { toast } from 'react-hot-toast';

/**
 * Limpia la descripción de un material para optimizar la búsqueda en Ferretería EPA.
 * Remueve puntuación, paréntesis y caracteres especiales que puedan afectar la consulta.
 * 
 * @param {string} raw - Descripción sin procesar
 * @returns {string} Texto limpio listo para consulta
 */
export function cleanEpaQuery(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/[()[\]{}"'\\/,:;.*+?^$!@#%&=_~`|<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Genera la URL directa de búsqueda en Ferretería EPA Venezuela.
 * 
 * @param {string} description - Descripción del material
 * @returns {string} URL formateada para el buscador de EPA
 */
export function getEpaUrl(description) {
  const clean = cleanEpaQuery(description);
  if (!clean) return 'https://ve.epaenlinea.com';
  return `https://ve.epaenlinea.com/catalogsearch/result/?q=${encodeURIComponent(clean)}`;
}

/**
 * Copia la descripción limpia al portapapeles y abre Ferretería EPA en una nueva pestaña.
 * 
 * @param {string} description - Descripción del insumo
 */
export function searchInEpa(description) {
  const clean = cleanEpaQuery(description);
  if (!clean) {
    toast.error('El material no tiene descripción válida para buscar');
    return;
  }

  // 1. Copiar al portapapeles con confirmación visual
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(clean)
      .then(() => {
        const preview = clean.length > 28 ? `${clean.slice(0, 28)}...` : clean;
        toast.success(`Copiado: "${preview}"`, {
          id: 'epa-copy-toast',
          duration: 2500,
          icon: '📋',
        });
      })
      .catch((err) => {
        console.warn('No se pudo acceder al portapapeles:', err);
      });
  }

  // 2. Abrir EPA Venezuela en nueva pestaña de forma segura
  const url = getEpaUrl(description);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Botón interactivo con el logo oficial de Ferretería EPA.
 * Ubicado sutilmente al lado de la descripción de los materiales junto a Mercado Libre.
 * Totalmente excluido de impresión física y exportaciones (print:hidden, no-print).
 * 
 * @param {Object} props
 * @param {string} props.description - Texto del material a buscar
 * @param {string} [props.className=''] - Clases Tailwind adicionales
 */
export default function EpaBadge({ description, className = '' }) {
  if (!description || !description.trim()) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    searchInEpa(description);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center p-0.5 rounded hover:bg-yellow-100/70 transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer shrink-0 print:hidden no-print select-none focus:outline-none ${className}`}
      title="Buscar en Ferretería EPA (copia al portapapeles y abre búsqueda)"
      aria-label="Buscar en Ferretería EPA"
    >
      <img
        src="/epa.png"
        alt="Ferretería EPA"
        className="h-5 w-auto object-contain pointer-events-none drop-shadow-2xs rounded-xs"
        loading="lazy"
      />
    </button>
  );
}
