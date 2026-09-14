import React from 'react';

const SummaryItem = ({ label, value, isTotal = false }) => (
  <div className={`flex justify-between items-center py-2 ${isTotal ? 'pt-4 mt-2 border-t border-gray-200' : ''}`}>
    <span className={`text-sm ${isTotal ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{label}</span>
    <span className={`font-mono ${isTotal ? 'text-lg font-bold text-blue-700' : 'text-sm font-medium text-gray-800'}`}>
      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value)}
    </span>
  </div>
);

const APUSummary = ({ totalMaterials = 0, totalEquipment = 0, totalLabor = 0 }) => {
  const directCost = totalMaterials + totalEquipment + totalLabor;
  
  // Note: These percentages would ideally come from the backend or settings
  const adminPercentage = 0.15; // 15% Administration
  const utilityPercentage = 0.10; // 10% Utility
  
  const adminCost = directCost * adminPercentage;
  const utilityCost = directCost * utilityPercentage;
  const subtotal = directCost + adminCost + utilityCost;
  const iva = subtotal * 0.16; // 16% IVA
  const grandTotal = subtotal + iva;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">Resumen de Costos</h3>
      
      <div className="space-y-1">
        <SummaryItem label="Total Materiales" value={totalMaterials} />
        <SummaryItem label="Total Equipos" value={totalEquipment} />
        <SummaryItem label="Total Mano de Obra" value={totalLabor} />
        <SummaryItem label="Costo Directo" value={directCost} isTotal={true} />
        
        <div className="pt-4 mt-4 border-t border-gray-100 space-y-1">
          <SummaryItem label="Administración (15%)" value={adminCost} />
          <SummaryItem label="Utilidad (10%)" value={utilityCost} />
          <SummaryItem label="Subtotal" value={subtotal} />
          <SummaryItem label="I.V.A. (16%)" value={iva} />
          <SummaryItem label="Precio Unitario Total" value={grandTotal} isTotal={true} />
        </div>
      </div>
    </div>
  );
};

export default APUSummary;
