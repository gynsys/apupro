import React from 'react';

export default function MarketIndicatorsPanel() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-slate-800">Insumos Líderes e Indicadores de Mercado</h2>
      <p className="text-slate-500 mt-2">
        Define los precios base del mercado (ej. Saco de Cemento, Cuñete de Pintura, Salario Mínimo).
        Al actualizar un precio aquí, cientos de insumos técnicos de la BD maestra calcularán su nuevo costo instantáneamente mediante su Factor de Relación.
      </p>
      
      <div className="mt-6 flex items-center justify-center h-48 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
        <span className="text-slate-400 font-medium">Panel en Construcción</span>
      </div>
    </div>
  );
}
