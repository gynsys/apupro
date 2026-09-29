import React, { useState, useEffect, useMemo } from 'react';
import AlliesLogoCard from './AlliesLogoCard';
import alliesService from '../../../services/alliesService';

// Aliado inicial por defecto (garantiza render inmediato)
const DEFAULT_ALLIES = [
  {
    id: 1,
    name: 'PALL FERRETERIA, C.A.',
    logo_url: '/images/allies/pall-ferreteria.png',
    category: 'Materiales y Ferretería',
    website_url: null,
    is_active: true
  }
];

export default function StrategicAlliesSection() {
  const [allies, setAllies] = useState(DEFAULT_ALLIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAllies = async () => {
      try {
        const data = await alliesService.getAllies();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setAllies(data);
        }
      } catch (err) {
        console.warn('Usando aliados locales por defecto:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAllies();
    return () => {
      isMounted = false;
    };
  }, []);

  // Generar lista para carrusel continuo infinito sin saltos
  const marqueeItems = useMemo(() => {
    if (!allies || allies.length === 0) return [];
    let list = [...allies];
    // Asegurar que la mitad inicial tenga al menos 6 elementos para cubrir cualquier pantalla
    while (list.length < 6) {
      list = [...list, ...allies];
    }
    // Duplicar exactamente para que la traslación al -50% sea un bucle continuo perfecto
    return [...list, ...list];
  }, [allies]);

  if (!allies || allies.length === 0) return null;

  return (
    <section className="relative py-14 sm:py-20 bg-white text-slate-900 overflow-hidden border-y border-slate-200">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Encabezado de la sección integrado en el fondo blanco */}
        <div className="max-w-3xl mx-auto text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Red de Colaboración
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Nuestros Aliados Estratégicos
          </h2>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Empresas y proveedores líderes que colaboran activamente para garantizar la vigencia y precisión de nuestros precios de mercado.
          </p>
        </div>
      </div>

      {/* Carrusel Marquee Continuo de extremo a extremo integrado en el fondo blanco */}
      <div className="relative w-full overflow-hidden z-10">
        {/* Sombra de desvanecimiento lateral izquierda hacia blanco */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-40 z-20 pointer-events-none bg-gradient-to-r from-white via-white/80 to-transparent" />
        
        {/* Sombra de desvanecimiento lateral derecha hacia blanco */}
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-40 z-20 pointer-events-none bg-gradient-to-l from-white via-white/80 to-transparent" />

        {/* Pista continua con animación infinita y pausa en hover */}
        <div className="animate-marquee-infinite flex items-center gap-10 sm:gap-16 py-3">
          {marqueeItems.map((ally, index) => (
            <AlliesLogoCard key={`${ally.id}-${index}`} ally={ally} />
          ))}
        </div>
      </div>
    </section>
  );
}
