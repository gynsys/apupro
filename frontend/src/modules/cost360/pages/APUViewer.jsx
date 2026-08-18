import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader, Package, Wrench, Users, Calculator, Printer, FileSpreadsheet } from 'lucide-react';
import cost360Service from '../services/cost360Service';
import PrintAPUModal from '../../../components/PrintAPUModal';
import PrintAPULayout from '../../../components/PrintAPULayout';
import ExportApuExcelButton from '../components/ExportApuExcelButton';
import ApuEditorUI from '../../../components/ApuEditorUI';

export default function APUViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dbId = searchParams.get('db') || 'master';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [item, setItem] = useState(null);
  const [settings, setSettings] = useState({
    admin_percent: 15,
    profit_percent: 10,
    fcas_percent: 417,
    iva_percent: 16,
    labor_bonus: 0,
    currency: 'USD'
  });
  
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState(null);

  useEffect(() => {
    const fetchAPU = async () => {
      try {
        setLoading(true);
        const apuData = await cost360Service.fetchApuDetails(id, dbId);
        setData(apuData);
        setItem({
          cod_par: apuData.partida.CodPar,
          cov_par: apuData.partida.CovPar,
          description: apuData.partida.Descri,
          unit: apuData.partida.UniPar,
          performance: apuData.partida.RenPar || 1,
          materials: (apuData.materiales || []).map(m => ({ id: m.codigo, codigo: m.codigo, descripcion: m.descripcion, unidad: m.unidad, cantidad: m.cantidad, precio_unitario: m.precio_unitario, desperdicio: m.desperdicio || 5, origen: 'historico' })),
          equipments: (apuData.equipos || []).map(e => ({ id: e.codigo, codigo: e.codigo, descripcion: e.descripcion, unidad: 'día', cantidad: e.cantidad, precio_unitario: e.precio_unitario, depreciacion: e.depreciacion || 1.0, origen: 'historico' })),
          labors: (apuData.mano_obra || []).map(l => ({ id: l.codigo, codigo: l.codigo, descripcion: l.descripcion, unidad: 'día', cantidad: l.cantidad, jornal: l.jornal, bono: l.bono, origen: 'historico' }))
        });
      } catch (err) {
        console.error("Error loading APU details:", err);
        setError("Error loading APU details");
      } finally {
        setLoading(false);
      }
    };
    fetchAPU();
  }, [id]);

  useEffect(() => {
    if (printOptions) {
      const handleAfterPrint = () => {
        setPrintOptions(null);
        setPrintModalOpen(false);
      };
      window.addEventListener('afterprint', handleAfterPrint);
      setTimeout(() => {
        window.print();
      }, 300);
      return () => window.removeEventListener('afterprint', handleAfterPrint);
    }
  }, [printOptions]);

  const handleComponentChange = (type, compId, field, value) => {
    setItem(prev => {
      const updated = { ...prev };
      updated[type] = updated[type].map(c => {
        if (c.id === compId) {
          const isNumeric = ['cantidad', 'precio_unitario', 'desperdicio', 'depreciacion', 'jornal'].includes(field);
          return { ...c, [field]: isNumeric ? (parseFloat(value) || 0) : value };
        }
        return c;
      });
      return updated;
    });
  };

  const handleHeaderChange = (field, value) => {
    setItem(prev => ({ ...prev, [field]: value }));
  };

  const handleRemoveRow = (type, id) => {
    setItem(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== id) }));
  };

  const handleAddRow = (type) => {
    const newId = 'NEW-' + Math.random().toString(36).substr(2, 9);
    setItem(prev => ({
      ...prev,
      [type]: [...prev[type], { id: newId, codigo: 's/c', descripcion: 'Nuevo ítem', cantidad: 1, precio_unitario: 0, origen: 'manual' }]
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (error || !data || !data.partida) {
    return (
      <div className="text-center p-8 text-red-500 bg-red-50 rounded-xl border border-red-200 m-6">
        {error || "APU not found"}
      </div>
    );
  }

  const { partida, materiales = [], equipos = [], mano_obra = [] } = data;


  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto min-h-screen pb-20 print:p-0 print:m-0 print:max-w-none print:bg-white print:w-full">
      {printOptions && (
        <PrintAPULayout 
          partida={partida} 
          materiales={materiales} 
          equipos={equipos} 
          mano_obra={mano_obra} 
          options={printOptions} 
        />
      )}
      
      {printModalOpen && (
        <PrintAPUModal 
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)} 
          onPrint={(options) => setPrintOptions(options)} 
        />
      )}
      
      <div className="print:hidden">
        {/* TOOLBAR */}
        <div className="flex items-center justify-between mb-4 sticky top-0 z-30 bg-gray-50/95 backdrop-blur py-3 px-4 md:px-6 border-b border-gray-200/50 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/cost360')}
              className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors shrink-0 shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
              <Calculator size={16} className="text-blue-500" /> ANÁLISIS DE PRECIO UNITARIO
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPrintModalOpen(true)}
              className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors shadow-sm flex items-center gap-2"
              title="Imprimir"
            >
              <Printer size={20} />
            </button>
            <ExportApuExcelButton
              item={item}
              settings={settings}
            />
          </div>
        </div>
      </div>
      {item && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ApuEditorUI
            item={item}
            settings={settings}
            onHeaderChange={handleHeaderChange}
            onComponentChange={handleComponentChange}
            onRemoveRow={handleRemoveRow}
            onAddBlankRow={handleAddRow}
            onSettingsChange={(field, value) => setSettings({ ...settings, [field]: value })}
          />
        </div>
      )}
    </div>
  );
}
