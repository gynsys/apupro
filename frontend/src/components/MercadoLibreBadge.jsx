import React from 'react';
import { ExternalLink, Handshake } from 'lucide-react';
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
 * Badge interactivo de Mercado Libre con colores de marca (#FFE600 / #2D3277).
 * 
 * @param {Object} props
 * @param {string} props.description - Texto del material
 * @param {boolean} [props.compact=false] - Modo compacto cuadrado para barras de acciones
 * @param {string} [props.className=''] - Clases Tailwind adicionales
 */
export default function MercadoLibreBadge({ description, compact = false, className = '' }) {
  if (!description || !description.trim()) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    searchInMercadoLibre(description);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center p-1 rounded-md bg-[#FFE600] hover:bg-[#FDD835] text-[#2D3277] border border-[#E6CF00] transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer group shrink-0 ${className}`}
        title="Copiar descripción y buscar en Mercado Libre"
      >
        <Handshake size={14} className="stroke-[2.2] group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#FFE600] hover:bg-[#FDD835] text-[#2D3277] border border-[#E6CF00] text-[10px] font-bold tracking-tight transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer group shrink-0 ${className}`}
      title="Copiar descripción y buscar en Mercado Libre"
    >
      <Handshake size={12} className="stroke-[2.4] text-[#2D3277] group-hover:scale-110 transition-transform shrink-0" />
      <span className="leading-none">Mercado Libre</span>
      <ExternalLink size={10} className="stroke-[2.2] opacity-70 group-hover:opacity-100 shrink-0" />
    </button>
  );
}
