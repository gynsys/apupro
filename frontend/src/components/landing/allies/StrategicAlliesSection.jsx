import React, { useState, useEffect } from 'react';
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
        // En caso de fallo de red, se mantiene el fallback por defecto
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

  if (!allies || allies.length === 0) return null;

  return (
    <section className="relative py-16 sm:py-20 bg-slate-950 text-white overflow-hidden border-y border-white/5">
      {/* Resplandor ambiental de fondo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[250px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Encabezado de la sección */}
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Red de Colaboración
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
            Nuestros Aliados Estratégicos
          </h2>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Empresas y proveedores líderes que colaboran activamente para garantizar la vigencia y precisión de nuestros precios de mercado.
          </p>
        </div>

        {/* Banner / Grid de Logos */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 max-w-5xl mx-auto">
          {allies.map((ally) => (
            <AlliesLogoCard key={ally.id} ally={ally} />
          ))}
        </div>
      </div>
    </section>
  );
}
