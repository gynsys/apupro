import React from 'react';
import { toast } from 'react-hot-toast';

/**
 * Limpia la descripción de un material para optimizar la búsqueda en Mercado Libre.
 * Remueve caracteres especiales, puntuación y paréntesis que suelen romper URLs o ensuciar la consulta.
 * 
 * @param {string} raw - Descripción sin procesar
 * @returns {string} Texto limpio listo para consulta
 */
export function cleanMercadoLibreQuery(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/[()[\]{}"'\\/,:;.*+?^$!@#%&=_~`|<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Genera la URL directa de búsqueda en Mercado Libre Venezuela.
 * 
 * @param {string} description - Descripción del material
 * @returns {string} URL formateada para Mercado Libre
 */
export function getMercadoLibreUrl(description) {
  const clean = cleanMercadoLibreQuery(description);
  if (!clean) return 'https://www.mercadolibre.com.ve';
  const slug = clean.toLowerCase().replace(/\s+/g, '-');
  return `https://listado.mercadolibre.com.ve/${encodeURIComponent(slug)}`;
}

/**
 * Copia la descripción limpia al portapapeles y abre Mercado Libre en una nueva pestaña.
 * 
 * @param {string} description - Descripción del insumo
 */
export function searchInMercadoLibre(description) {
  const clean = cleanMercadoLibreQuery(description);
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
          id: 'ml-copy-toast',
          duration: 2500,
          icon: '📋',
        });
      })
      .catch((err) => {
        console.warn('No se pudo acceder al portapapeles:', err);
      });
  }

  // 2. Abrir Mercado Libre en nueva pestaña de forma segura
  const url = getMercadoLibreUrl(description);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Botón interactivo con el logo oficial de Mercado Libre.
 * Ubicado sutilmente al lado de la descripción de los materiales.
 * Totalmente excluido de impresión física y exportaciones (print:hidden, no-print).
 * 
 * @param {Object} props
 * @param {string} props.description - Texto del material a buscar
 * @param {string} [props.className=''] - Clases Tailwind adicionales
 */
export default function MercadoLibreBadge({ description, className = '' }) {
  if (!description || !description.trim()) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    searchInMercadoLibre(description);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center p-0.5 rounded hover:bg-amber-100/60 transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer shrink-0 print:hidden no-print select-none focus:outline-none ${className}`}
      title="Buscar en Mercado Libre (copia al portapapeles y abre búsqueda)"
      aria-label="Buscar en Mercado Libre"
    >
      <img
        src="/mercadolibre.png"
        alt="Mercado Libre"
        className="w-5 h-5 object-contain pointer-events-none drop-shadow-2xs"
        loading="lazy"
      />
    </button>
  );
}
