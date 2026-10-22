import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportApuExcelCustom } from '../services/costbaseService';
import { numeroALetras } from '../../../utils/numberToLetters';
import { calculateItemBreakdown } from '../../../utils/apuCalculations';
import { filterBlankComponentRows } from '../../../utils/apuRows';
import { useUserCostos } from '../../../context/UserCostosContext';

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
  title = "Exportar a Excel",
  iconSize = 20
}) {
  const [isExporting, setIsExporting] = useState(false);

  let costosConfig = null;
  try {
    const ctx = useUserCostos();
    costosConfig = ctx?.costosConfig;
  } catch (_) {
    costosConfig = null;
  }

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const effectiveLaborBonus = parseFloat(
        settings?.labor_bonus ??
        settings?.fcasLaborBonus ??
        item?.labor_bonus ??
        costosConfig?.fcasLaborBonus ??
        0
      ) || 0;

      const rawBonoInFcas = settings?.bono_in_fcas ?? item?.bono_in_fcas ?? costosConfig?.fcasBonoInFcas;
      const effectiveFcasPercent = parseFloat(
        settings?.fcas_percent ??
        item?.fcas_percent ??
        costosConfig?.fcas ??
        417.0
      );
      const effectiveBonoInFcas = rawBonoInFcas === true || (rawBonoInFcas !== false && effectiveFcasPercent >= 1000);

      const cleanMaterials = filterBlankComponentRows(materials.length ? materials : (item?.materials || []));
      const cleanEquipments = filterBlankComponentRows(equipments.length ? equipments : (item?.equipments || []));
      const rawLabors = filterBlankComponentRows(labors.length ? labors : (item?.labors || []));
      const mappedLabors = rawLabors.map(lab => {
        const rawBono = (lab.bono != null && lab.bono !== '')
          ? parseFloat(lab.bono)
          : (lab.Bono != null && lab.Bono !== '' ? parseFloat(lab.Bono) : null);

        let finalBono = 0;
        if (!effectiveBonoInFcas) {
          if (rawBono !== null && !isNaN(rawBono) && rawBono > 0) {
            finalBono = rawBono;
          } else {
            finalBono = effectiveLaborBonus;
          }
        }

        return {
          ...lab,
          bono: finalBono,
          Bono: finalBono
        };
      });

      const calcPrice = (currSettings) => {
        const itemToCalc = {
          ...item,
          materials: cleanMaterials,
          equipments: cleanEquipments,
          labors: mappedLabors
        };
        const breakdown = calculateItemBreakdown(itemToCalc, currSettings);
        return breakdown.unitPrice;
      };

      const intermediateSettings = {
        ...settings,
        labor_bonus: effectiveLaborBonus,
        bono_in_fcas: effectiveBonoInFcas,
        fcas_percent: effectiveFcasPercent
      };

      const finalPrice = calcPrice(intermediateSettings);
      const currency = settings?.currency || item?.currency || "USD";
      const currencyWord = String(currency).toUpperCase().includes("USD") ? "DÓLARES" : "Bs.";
      const sonLetras = `SON: ( ${numeroALetras(finalPrice)} ${currencyWord} ctms )`;

      const finalSettings = {
        ...intermediateSettings,
        currency,
        son_letras: sonLetras
      };

      const payload = {
        item: item || {},
        materials: cleanMaterials,
        equipments: cleanEquipments,
        labors: mappedLabors,
        settings: finalSettings
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
      onClick={(e) => { e.stopPropagation(); handleExport(); }}
      disabled={isExporting}
      className={`${className} ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}`}
      title={title}
    >
      {isExporting ? <Loader2 size={iconSize} className="animate-spin" /> : <ExcelIcon size={iconSize} />}
    </button>
  );
}
