import React from 'react';

export default function DemoChrome({ children, height = 'h-[520px] sm:h-[600px]' }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-blue-900/25 transition-all duration-500 hover:shadow-blue-500/10 ${height}`}>
      <div className="flex h-11 items-center gap-2 border-b border-slate-800 bg-slate-950 px-4">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-amber-500/80" />
          <div className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        <div className="mx-auto w-72 select-none rounded-md border border-slate-700/60 bg-slate-800/60 px-4 py-1 text-center font-mono text-xs text-slate-300">
          app.costbase.net
        </div>
      </div>
      <div className="relative h-[calc(100%-2.75rem)] overflow-hidden bg-[#f0f4fd] text-slate-800">
        {children}
      </div>
    </div>
  );
}
