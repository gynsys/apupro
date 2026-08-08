import React from 'react';

export default function PreviewSection() {
  return (
    <section className="py-24 bg-slate-950 relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-blue-900/20 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Interfaz diseñada para la Productividad
          </h2>
          <p className="text-slate-400 text-lg">
            Todo lo que necesitas en una sola pantalla. Buscador rápido, edición inline y previsualización de costos en tiempo real.
          </p>
        </div>

        {/* Browser Mockup */}
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden shadow-blue-900/20">
            {/* Header */}
            <div className="h-12 bg-slate-950 border-b border-slate-800 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="mx-auto bg-slate-800/50 text-slate-400 text-xs py-1 px-3 rounded-md w-64 text-center font-mono border border-slate-700/50">
                app.costbase.com/dashboard
              </div>
            </div>
            
            {/* Body */}
            <div className="p-6 md:p-8 bg-slate-900/50">
              <div className="flex flex-col gap-6">
                {/* Fake App Structure */}
                <div className="flex justify-between items-end">
                  <div>
                    <div className="h-4 w-24 bg-slate-700 rounded mb-2" />
                    <div className="h-8 w-64 bg-slate-200 rounded" />
                  </div>
                  <div className="h-10 w-32 bg-blue-600 rounded-xl" />
                </div>
                
                <div className="flex gap-6">
                  {/* Sidebar Fake */}
                  <div className="hidden md:flex flex-col gap-3 w-48 shrink-0">
                    <div className="h-10 bg-slate-800 rounded-xl" />
                    <div className="h-10 bg-slate-800/50 rounded-xl" />
                    <div className="h-10 bg-slate-800/50 rounded-xl" />
                    <div className="h-10 bg-slate-800/50 rounded-xl" />
                  </div>
                  
                  {/* Content Fake */}
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-24 bg-slate-800 rounded-2xl border border-slate-700" />
                      <div className="h-24 bg-slate-800 rounded-2xl border border-slate-700" />
                      <div className="h-24 bg-slate-800 rounded-2xl border border-slate-700" />
                    </div>
                    <div className="h-64 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col p-4 gap-3">
                      <div className="h-8 bg-slate-700/50 rounded-lg w-full" />
                      <div className="h-8 bg-slate-700/30 rounded-lg w-full" />
                      <div className="h-8 bg-slate-700/30 rounded-lg w-full" />
                      <div className="h-8 bg-slate-700/30 rounded-lg w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
