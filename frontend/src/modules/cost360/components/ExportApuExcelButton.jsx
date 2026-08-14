import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportApuExcelCustom } from '../services/cost360Service';
import { numeroALetras } from '../../utils/numberToLetters';

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
      
      const calcPrice = () => {
        const rendimiento = parseFloat(item?.performance || item?.rendimiento || item?.RenPar || 1.0);
        const adminGG = parseFloat(settings?.admin_percent ?? 15.0);
        const profit = parseFloat(settings?.profit_percent ?? 10.0);
        const fcas = parseFloat(settings?.fcas_percent ?? 435.0);
        const financiamiento = parseFloat(settings?.financiamiento ?? 0.0);
        const iva = parseFloat(settings?.iva_percent ?? 16.0);
        const otrosImp = parseFloat(settings?.otros_imp ?? 0.0);

        const matList = materials.length ? materials : (item?.materials || []);
        const eqList = equipments.length ? equipments : (item?.equipments || []);
        const labList = labors.length ? labors : (item?.labors || []);

        const matTotal = matList.reduce((acc, m) => {
            const qty = parseFloat(m?.cantidad || m?.CanIns || 0);
            const price = parseFloat(m?.precio_unitario || m?.precio || m?.CosMat || 0);
            const waste = parseFloat(m?.desperdicio || m?.Desper || 0);
            return acc + (qty * price * (1 + waste / 100));
        }, 0);

        const eqTotal = eqList.reduce((acc, e) => {
            const qty = parseFloat(e?.cantidad || e?.CanIns || 0);
            const price = parseFloat(e?.precio_unitario || e?.precio || e?.CosDia || 0);
            const dep = parseFloat(e?.depreciacion ?? e?.Deprec ?? 1.0);
            return acc + (qty * price * dep);
        }, 0);

        const moJornal = labList.reduce((acc, l) => {
            const qty = parseFloat(l?.cantidad || l?.CanIns || 0);
            const price = parseFloat(l?.jornal || l?.Jornal || 0);
            return acc + (qty * price);
        }, 0);

        const moBono = labList.reduce((acc, l) => {
            const qty = parseFloat(l?.cantidad || l?.CanIns || 0);
            const price = parseFloat(l?.bono || l?.Bono || 0);
            return acc + (qty * price);
        }, 0);

        const moPs = (fcas / 100.0) * moJornal;
        const totalMo = moJornal + moBono + moPs;

        const cuoEq = eqTotal / rendimiento;
        const cuoMo = totalMo / rendimiento;

        const cdVal = parseFloat((matTotal + cuoEq + cuoMo).toFixed(2));
        const adVal = parseFloat(((cdVal * adminGG) / 100).toFixed(2));
        const sbVal = cdVal + adVal;
        const iuVal = parseFloat(((sbVal * profit) / 100).toFixed(2));
        const scVal = sbVal + iuVal;
        const finVal = parseFloat(((scVal * financiamiento) / 100).toFixed(2));
        const psVal = scVal + finVal;
        const ivaVal = parseFloat(((psVal * iva) / 100).toFixed(2));
        const oiVal = parseFloat(((psVal * otrosImp) / 100).toFixed(2));

        return psVal + ivaVal + oiVal;
      };

      const finalPrice = calcPrice();
      const currency = settings?.currency || "Bs.";
      const currencyWord = String(currency).toUpperCase().includes("USD") ? "DÓLARES" : "Bs.";
      const sonLetras = `SON: ( ${numeroALetras(finalPrice)} ${currencyWord} ctms )`;

      const finalSettings = { ...settings, son_letras: sonLetras };

      const payload = {
        item: item || {},
        materials: materials.length ? materials : (item?.materials || []),
        equipments: equipments.length ? equipments : (item?.equipments || []),
        labors: labors.length ? labors : (item?.labors || []),
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
      onClick={handleExport}
      disabled={isExporting}
      className={`${className} ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}`}
      title={title}
    >
      {isExporting ? <Loader2 size={20} className="animate-spin" /> : <ExcelIcon size={20} />}
    </button>
  );
}
