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
    <section className="relative py-8 sm:py-12 bg-white text-slate-900 overflow-hidden border-y border-slate-200/80">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Encabezado armónico y refinado */}
        <div className="max-w-2xl mx-auto text-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 mb-2">
            Nuestros Aliados Estratégicos
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xl mx-auto">
            Empresas y proveedores líderes que colaboran activamente para garantizar la vigencia y precisión de nuestros precios de mercado.
          </p>
        </div>
      </div>

      {/* Carrusel Marquee Continuo de extremo a extremo */}
      <div className="relative w-full overflow-hidden z-10">
        {/* Sombra de desvanecimiento lateral izquierda hacia blanco */}
        <div className="absolute left-0 top-0 bottom-0 w-20 sm:w-44 z-20 pointer-events-none bg-gradient-to-r from-white via-white/80 to-transparent" />
        
        {/* Sombra de desvanecimiento lateral derecha hacia blanco */}
        <div className="absolute right-0 top-0 bottom-0 w-20 sm:w-44 z-20 pointer-events-none bg-gradient-to-l from-white via-white/80 to-transparent" />

        {/* Pista continua con animación infinita y pausa en hover */}
        <div className="animate-marquee-infinite flex items-center gap-12 sm:gap-20 py-2">
          {marqueeItems.map((ally, index) => (
            <AlliesLogoCard key={`${ally.id}-${index}`} ally={ally} />
          ))}
        </div>
      </div>
    </section>
  );
}
