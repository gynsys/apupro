import React, { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { exportApuExcelCustom } from '../services/cost360Service';

export default function ExportApuExcelButton({ 
  item, 
  materials = [], 
  equipments = [], 
  labors = [], 
  settings = {},
  className = "p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-green-600 transition-colors shadow-sm flex items-center gap-2",
  title = "Exportar a Excel"
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const payload = {
        item: item || {},
        materials: materials.length ? materials : (item?.materials || []),
        equipments: equipments.length ? equipments : (item?.equipments || []),
        labors: labors.length ? labors : (item?.labors || []),
        settings: settings || {}
      };
      
      await exportApuExcelCustom(payload);
      
    } catch (error) {
      console.error('Error al exportar APU a Excel:', error);
      alert('Hubo un error al exportar el APU a Excel. Revisa la consola para más detalles.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button 
      onClick={handleExport}
      disabled={isExporting}
      className={`${className} ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}`}
      title={title}
    >
      {isExporting ? <Loader2 size={20} className="animate-spin" /> : <FileSpreadsheet size={20} />}
    </button>
  );
}
