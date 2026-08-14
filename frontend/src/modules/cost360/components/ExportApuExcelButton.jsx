import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportApuExcelCustom } from '../services/cost360Service';

const ExcelIcon = ({ size = 20, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.5 12L14.5 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.5 12L9.5 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

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
      toast.error('Hubo un error al exportar el APU a Excel.');
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
      {isExporting ? <Loader2 size={20} className="animate-spin" /> : <ExcelIcon size={20} />}
    </button>
  );
}
