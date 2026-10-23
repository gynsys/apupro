import React from 'react';
import AnimatedPreview from './preview/AnimatedPreview';

export default function PreviewSection() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-24">
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[85%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-900/20 blur-[150px]" />

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <h2 className="mb-5 text-3xl font-bold tracking-tight text-white md:text-5xl">
            Interfaz diseñada para la Productividad
          </h2>
          <p className="text-base text-slate-400 md:text-lg">
            Todo lo que necesitas en una sola pantalla. Buscador rápido, edición inline y previsualización de costos en tiempo real.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <AnimatedPreview />
        </div>
      </div>
    </section>
  );
}
