import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Package, Wrench, Users, Calculator, Plus, Printer, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { budgetService } from '../../services/budgetService';
import { API_URL } from '../../services/api';
import ComponentSearchModal from '../../components/ComponentSearchModal';
import PrintAPUModal from '../../components/PrintAPUModal';
import PrintAPULayout from '../../components/PrintAPULayout';
import ApuEditorUI from '../../components/ApuEditorUI';
import ExportApuExcelButton from '../../modules/cost360/components/ExportApuExcelButton';


export default function BudgetAPUEditorPage() {
  const { id, itemId } = useParams();
  const navigate = useNavigate();

  const [budget, setBudget] = useState(null);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [editingHeader, setEditingHeader] = useState({ code: false, description: false });
  
  const [searchModal, setSearchModal] = useState({ isOpen: false, type: '', title: '' });
  const [syncing, setSyncing] = useState(false);
  
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState(null);

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

      return () => {
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [printOptions]);



  // ── Numeric field change (local state only) ──────────────────────────────
  const handleComponentChange = (type, compId, field, value) => {
    const val = parseFloat(value) || 0;
    setItem(prev => {
      const updated = { ...prev };
      updated[type] = updated[type].map(c =>
        c.id === compId ? { ...c, [field]: val } : c
      );
      return updated;
    });
  };

  const handleComponentBlur = async (type, compId, field, value) => {
    const val = parseFloat(value) || 0;
    try {
      await budgetService.updateComponent(id, itemId, type, compId, { [field]: val });
    } catch (error) {
      toast.error('Error al actualizar el componente');
      loadData();
    }
  };

  // ── Text field change (description / codigo) ─────────────────────────────
  const handleTextChange = (type, compId, field, value) => {
    setItem(prev => ({
      ...prev,
      [type]: prev[type].map(c => c.id === compId ? { ...c, [field]: value } : c)
    }));
  };

  const handleTextBlur = async (type, compId, field, value) => {
    try {
      await budgetService.updateComponent(id, itemId, type, compId, { [field]: value });
      toast.success('Actualizado');
      loadData(); // Recargar datos para reflejar cambios
    } catch (error) {
      toast.error('Error al actualizar');
      loadData();
    }
  };

  // ── Delete component ─────────────────────────────────────────────────────
  const handleDeleteComponent = async (type, compId) => {
    setDeletingId(compId);
    try {
      await budgetService.deleteComponent(id, itemId, type, compId);
      setItem(prev => ({
        ...prev,
        [type]: prev[type].filter(c => c.id !== compId)
      }));
      toast.success('Eliminado');
    } catch (error) {
      toast.error('Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, itemId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const budgetData = await budgetService.getById(id);
      setBudget(budgetData);
      const foundItem = budgetData.items.find(i => i.id === itemId);
      if (!foundItem) {
        toast.error('Partida no encontrada en este presupuesto');
        navigate(`/budgets/${id}`);
      }
      setItem(foundItem);
    } catch (error) {
      console.error(error);
      toast.error('Error cargando APU');
    } finally {
      setLoading(false);
    }
  };

  const handlePerformanceChange = async (newPerf) => {
    const val = parseFloat(newPerf) || 1;
    setItem(prev => ({ ...prev, performance: val }));
    try {
      await budgetService.updateItem(id, itemId, { performance: val });
    } catch (error) {
      toast.error('Error actualizando rendimiento');
    }
  };

  const handleHeaderFieldChange = (field, value) => {
    let finalValue = value;
    if (field === 'performance' || field === 'rendimiento') {
      finalValue = parseFloat(value) || 0;
      setItem(prev => ({ ...prev, performance: finalValue, rendimiento: finalValue }));
      return;
    }
    setItem(prev => ({ ...prev, [field]: finalValue }));
  };

  const handleHeaderFieldBlur = async (field, value) => {
    try {
      let finalField = field;
      let finalValue = value;
      if (field === 'rendimiento' || field === 'performance') {
        finalField = 'performance';
        finalValue = parseFloat(value) || 1.0;
        if (finalValue <= 0) finalValue = 1.0;
        setItem(prev => ({ ...prev, performance: finalValue, rendimiento: finalValue }));
      }
      await budgetService.updateItem(id, itemId, { [finalField]: finalValue });
      toast.success('Rendimiento actualizado');
      setEditingHeader(prev => ({ ...prev, [field === 'cov_par' ? 'code' : 'description']: false }));
    } catch (error) {
      toast.error('Error al actualizar');
      loadData();
    }
  };

  const handleAddComponent = async (componentData) => {
    try {
      setLoading(true);
      await budgetService.addComponent(id, itemId, searchModal.type, componentData);
      toast.success('Agregado con éxito');
      setSearchModal({ isOpen: false, type: '', title: '' });
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Error al agregar el insumo');
      setLoading(false);
    }
  };

  const handleSelectComponent = async (type, compId, selectedData) => {
    try {
      setLoading(true);
      if (!compId) {
        // Adding new component from modal
        await budgetService.addComponent(id, itemId, type, selectedData);
        toast.success('Insumo agregado con éxito');
      } else if (String(compId).startsWith('NEW-')) {
        // It was a newly added blank row
        const existingRow = item[type]?.find(c => c.id === compId) || {};
        const payload = {
          ...selectedData,
          cantidad: existingRow.cantidad || 1,
          ...(type === 'materials' ? { desperdicio: existingRow.desperdicio ?? 5.0, unidad: selectedData.unidad || existingRow.unidad || 'UND' } : {}),
          ...(type === 'equipments' ? { depreciacion: existingRow.depreciacion ?? 1.0 } : {}),
        };
        await budgetService.addComponent(id, itemId, type, payload);
        toast.success('Insumo agregado con éxito');
      } else {
        // Replacing/updating an existing component
        const payload = {
          codigo: selectedData.codigo,
          descripcion: selectedData.descripcion,
          ...(type === 'materials' ? {
            unidad: selectedData.unidad,
            precio_unitario: selectedData.precio_unitario
          } : {}),
          ...(type === 'equipments' ? {
            precio_unitario: selectedData.precio_unitario,
            depreciacion: selectedData.depreciacion
          } : {}),
          ...(type === 'labors' ? {
            jornal: selectedData.jornal,
            bono: selectedData.bono
          } : {})
        };
        await budgetService.updateComponent(id, itemId, type, compId, payload);
        toast.success('Insumo actualizado');
      }
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar insumo');
      setLoading(false);
    }
  };

  // ── Handlers for Manual Blank Rows (to match AI logic) ─────────────
  const handleAddBlankRow = (type) => {
    setItem(prev => {
      const updated = { ...prev };
      const newRow = {
        id: "NEW-" + Math.floor(Math.random() * 100000),
        codigo: "",
        descripcion: "",
        cantidad: 1,
        precio_unitario: 0,
      };
      
      if (type === 'materials') {
        newRow.unidad = "und";
        newRow.desperdicio = 0;
      } else if (type === 'equipments') {
        newRow.depreciacion = 1.0;
      } else if (type === 'labors') {
        newRow.jornal = 0;
      }
      
      updated[type] = [...(updated[type] || []), newRow];
      return updated;
    });
  };

  const handleRemoveRow = async (type, compId) => {
    // If it's a NEW row (not saved in DB), just remove it from local state
    if (String(compId).startsWith('NEW-')) {
      setItem(prev => ({
        ...prev,
        [type]: prev[type].filter(c => c.id !== compId)
      }));
    } else {
      // If it exists in backend, delete via API
      handleDeleteComponent(type, compId);
    }
  };

  const handleApuEditorComponentChange = (type, compId, field, value) => {
    // For text fields like codigo, descripcion, unidad
    if (['codigo', 'descripcion', 'unidad'].includes(field)) {
      handleTextChange(type, compId, field, value);
    } else {
      handleComponentChange(type, compId, field, value);
    }
  };

  const handleApuEditorComponentBlur = async (type, compId, field, value) => {
    if (type === 'performance' || type === 'rendimiento') {
      return handleHeaderFieldBlur('performance', compId);
    }
    if (!field && compId !== undefined && typeof type === 'string') {
      return handleHeaderFieldBlur(type, compId);
    }
    // We only send to API if it's NOT a new row
    if (String(compId).startsWith('NEW-')) {
      // If the user finishes editing a new row, and it has valid desc/price, we could auto-save it
      // For now, we wait for a manual save button? Actually, in budgets, changes save automatically.
      // We will create the component if it has enough data.
      if (field === 'descripcion' && value.trim() !== '') {
        try {
          const compToSave = item[type].find(c => c.id === compId);
          if (compToSave) {
            setLoading(true);
            const dataToSave = { ...compToSave };
            delete dataToSave.id; // remove fake ID
            await budgetService.addComponent(id, itemId, type, dataToSave);
            toast.success('Insumo guardado');
            await loadData();
          }
        } catch (error) {
          toast.error('Error al guardar nuevo insumo');
          setLoading(false);
        }
      }
      return;
    }

    if (['codigo', 'descripcion', 'unidad'].includes(field)) {
      handleTextBlur(type, compId, field, value);
    } else {
      handleComponentBlur(type, compId, field, value);
    }
  };

  const currentIndex = budget ? budget.items.findIndex(i => i.id === itemId) : -1;
  const prevItem = currentIndex > 0 ? budget.items[currentIndex - 1] : null;
  const nextItem = currentIndex !== -1 && currentIndex < budget.items.length - 1 ? budget.items[currentIndex + 1] : null;

  if (loading || !item || !budget) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <Loader className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-24 print:p-0 print:m-0 print:max-w-none print:bg-white print:w-full">
      {printOptions && (
        <PrintAPULayout
          partida={{ ...item, fcas_percent: budget.fcas_percent, admin_percent: budget.admin_percent, util_percent: budget.profit_percent ?? budget.util_percent ?? 10, rendimiento: item.performance, cantidad: item.quantity }}
          materiales={item.materials || []}
          equipos={item.equipments || []}
          mano_obra={item.labors || []}
          options={{ ...printOptions, companyName: budget.name }}
        />
      )}
      
      {printModalOpen && (
        <PrintAPUModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          onPrint={(options) => setPrintOptions(options)}
          budgetName={budget.name}
        />
      )}
      
      <div className="print:hidden flex flex-col min-h-full">
        {/* TOOLBAR */}
        <div className="flex items-center justify-between mb-4 sticky top-0 z-30 bg-gray-50/95 backdrop-blur py-3 px-4 md:px-6 border-b border-gray-200/50 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/budgets/${id}`)}
              className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 hover:border-blue-400 hover:shadow-md transition-all duration-200 shrink-0 shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-6">
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Calculator size={16} className="text-blue-500" /> APU PRESUPUESTADO
              </h2>
              
              {/* Navegación APUs */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                <button
                  onClick={() => navigate(`/budgets/${id}/item/${prevItem.id}`)}
                  disabled={!prevItem}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  title={prevItem ? "APU Anterior" : "Este es el primer APU"}
                >
                  <ChevronLeft size={20} className="text-slate-700" />
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button
                  onClick={() => navigate(`/budgets/${id}/item/${nextItem.id}`)}
                  disabled={!nextItem}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  title={nextItem ? "Siguiente APU" : "Este es el último APU"}
                >
                  <ChevronRight size={20} className="text-slate-700" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPrintModalOpen(true)}
              className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 hover:border-blue-400 hover:shadow-md transition-all duration-200 shadow-sm"
              title="Imprimir"
            >
              <Printer size={20} />
            </button>
            <ExportApuExcelButton
              item={item}
              materials={item.materials || []}
              equipments={item.equipments || []}
              labors={item.labors || []}
              settings={{
                currency: budget.currency,
                exchange_rate: budget.exchange_rate,
                fcas_percent: budget.fcas_percent,
                admin_percent: budget.admin_percent,
                profit_percent: budget.profit_percent ?? budget.util_percent ?? 10,
                iva_percent: 0,
                project_name: budget.name,
                client_name: budget.client_name
              }}
            />
          </div>
        </div>

        <div key={item.id} className="animate-in fade-in zoom-in-95 duration-300">
          <ApuEditorUI
            item={item}
            settings={{
              currency: budget.currency,
              exchange_rate: budget.exchange_rate || 1.0,
              material_inflation: budget.material_inflation || 0,
              equipment_inflation: budget.equipment_inflation || 0,
              labor_inflation: budget.labor_inflation || 0,
              labor_bonus: budget.labor_bonus || 0,
              fcas_percent: budget.fcas_percent || 417,
              admin_percent: budget.admin_percent || 15,
              profit_percent: budget.profit_percent || 10,
              iva_percent: 0
            }}
            onHeaderChange={handleHeaderFieldChange}
            onHeaderBlur={handleHeaderFieldBlur}
            onComponentChange={handleApuEditorComponentChange}
            onComponentBlur={handleApuEditorComponentBlur}
            onRemoveRow={handleRemoveRow}
            onAddBlankRow={handleAddBlankRow}
            onAddSearchRow={(type) => setSearchModal({ isOpen: true, type, title: `Buscar ${type}` })}
            onSelectComponent={handleSelectComponent}
            deletingId={deletingId}
          />
        </div>
      </div>
      <ComponentSearchModal
        isOpen={searchModal.isOpen}
        type={searchModal.type}
        title={searchModal.title}
        onClose={() => setSearchModal({ isOpen: false, type: '', title: '' })}
        onAdd={handleAddComponent}
      />
    </div>
  );
}
