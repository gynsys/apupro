import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Package, Wrench, Users, Calculator, Plus, Printer, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { budgetService } from '../../services/budgetService';
import { API_URL } from '../../services/api';
import ComponentSearchModal from '../../components/ComponentSearchModal';
import PrintAPUModal from '../../components/PrintAPUModal';
import PrintAPULayout from '../../components/PrintAPULayout';
import ApuEditorUI from '../../components/ApuEditorUI';
import ExportApuExcelButton from '../../modules/costbase/components/ExportApuExcelButton';
import { calculateBudgetTotals, calculateItemPU } from '../../utils/apuCalculations';


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



  // ── Helper to update item and sync budget.items without full reload ───────
  const updateItemInState = (updater) => {
    setItem(prev => {
      if (!prev) return prev;
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      setBudget(prevBudget => {
        if (!prevBudget || !prevBudget.items) return prevBudget;
        return {
          ...prevBudget,
          items: prevBudget.items.map(it => it.id === itemId ? updated : it)
        };
      });
      return updated;
    });
  };

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
      setBudget(prev => {
        if (!prev || !prev.items) return prev;
        return {
          ...prev,
          items: prev.items.map(it => it.id === itemId ? {
            ...it,
            [type]: (it[type] || []).map(c => c.id === compId ? { ...c, [field]: val } : c)
          } : it)
        };
      });
    } catch (error) {
      toast.error('Error al actualizar el componente');
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
      setBudget(prev => {
        if (!prev || !prev.items) return prev;
        return {
          ...prev,
          items: prev.items.map(it => it.id === itemId ? {
            ...it,
            [type]: (it[type] || []).map(c => c.id === compId ? { ...c, [field]: value } : c)
          } : it)
        };
      });
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  // ── Delete component ─────────────────────────────────────────────────────
  const handleDeleteComponent = async (type, compId) => {
    setDeletingId(compId);
    try {
      await budgetService.deleteComponent(id, itemId, type, compId);
      updateItemInState(prev => ({
        ...prev,
        [type]: (prev[type] || []).filter(c => c.id !== compId)
      }));
      toast.success('Insumo eliminado');
    } catch (error) {
      toast.error('Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    // Si el presupuesto ya está cargado en memoria, cambiar al APU de forma instantánea sin parpadeo
    if (budget && budget.id === id) {
      const foundItem = budget.items?.find(i => i.id === itemId);
      if (foundItem) {
        setItem(foundItem);
        return;
      }
    }
    loadData();
  }, [id, itemId]);

  const loadData = async () => {
    try {
      if (!budget || !item) {
        setLoading(true);
      }
      const budgetData = await budgetService.getById(id);
      setBudget(budgetData);
      const foundItem = budgetData.items?.find(i => i.id === itemId);
      if (!foundItem) {
        toast.error('Partida no encontrada en este presupuesto');
        navigate(`/budgets/${id}`);
        return;
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
    updateItemInState(prev => ({ ...prev, performance: val, rendimiento: val }));
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
      }
      updateItemInState(prev => ({
        ...prev,
        [finalField]: finalValue,
        ...(finalField === 'performance' ? { rendimiento: finalValue } : {})
      }));
      await budgetService.updateItem(id, itemId, { [finalField]: finalValue });
      toast.success(finalField === 'performance' ? 'Rendimiento actualizado' : 'Partida actualizada');
      setEditingHeader(prev => ({ ...prev, [field === 'cov_par' ? 'code' : 'description']: false }));
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleAddComponent = async (componentData) => {
    try {
      const addedComp = await budgetService.addComponent(id, itemId, searchModal.type, componentData);
      toast.success('Insumo agregado con éxito');
      setSearchModal({ isOpen: false, type: '', title: '' });
      updateItemInState(prev => ({
        ...prev,
        [searchModal.type]: [...(prev[searchModal.type] || []), addedComp]
      }));
    } catch (error) {
      console.error(error);
      toast.error('Error al agregar el insumo');
    }
  };

  const handleSelectComponent = async (type, compId, selectedData) => {
    try {
      if (!compId) {
        // Adding new component from modal
        const addedComp = await budgetService.addComponent(id, itemId, type, selectedData);
        toast.success('Insumo agregado con éxito');
        updateItemInState(prev => ({
          ...prev,
          [type]: [...(prev[type] || []), addedComp]
        }));
      } else if (String(compId).startsWith('NEW-')) {
        // It was a newly added blank row
        const existingRow = item[type]?.find(c => c.id === compId) || {};
        const payload = {
          ...selectedData,
          cantidad: existingRow.cantidad || 1,
          ...(type === 'materials' ? { desperdicio: existingRow.desperdicio ?? 5.0, unidad: selectedData.unidad || existingRow.unidad || 'UND' } : {}),
          ...(type === 'equipments' ? { depreciacion: selectedData.depreciacion != null ? selectedData.depreciacion : (existingRow.depreciacion ?? 1.0) } : {}),
        };
        const addedComp = await budgetService.addComponent(id, itemId, type, payload);
        toast.success('Insumo agregado con éxito');
        updateItemInState(prev => ({
          ...prev,
          [type]: (prev[type] || []).map(c => c.id === compId ? addedComp : c)
        }));
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
        const updatedComp = await budgetService.updateComponent(id, itemId, type, compId, payload);
        toast.success('Insumo actualizado');
        updateItemInState(prev => ({
          ...prev,
          [type]: (prev[type] || []).map(c => c.id === compId ? { ...c, ...updatedComp } : c)
        }));
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar insumo');
    }
  };

  // ── Handlers for Manual Blank Rows (to match AI logic) ─────────────
  const handleAddBlankRow = (type) => {
    const newId = "NEW-" + Math.floor(Math.random() * 100000);
    setItem(prev => {
      const updated = { ...prev };
      const newRow = {
        id: newId,
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
    return newId;
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
      if (field === 'descripcion' && value.trim() !== '') {
        try {
          const compToSave = item[type]?.find(c => c.id === compId);
          if (compToSave) {
            const dataToSave = { ...compToSave };
            delete dataToSave.id; // remove fake ID
            const savedComp = await budgetService.addComponent(id, itemId, type, dataToSave);
            toast.success('Insumo guardado');
            updateItemInState(prev => ({
              ...prev,
              [type]: (prev[type] || []).map(c => c.id === compId ? savedComp : c)
            }));
          }
        } catch (error) {
          toast.error('Error al guardar nuevo insumo');
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

  const currentBudget = useMemo(() => {
    if (!budget) return null;
    if (!item) return budget;
    return {
      ...budget,
      items: (budget.items || []).map(i => i.id === item.id ? item : i)
    };
  }, [budget, item]);

  const { subtotalPresupuesto } = useMemo(() => {
    if (!currentBudget) return { subtotalPresupuesto: 0 };
    return calculateBudgetTotals(currentBudget);
  }, [currentBudget]);

  const pu = useMemo(() => {
    if (!item || !budget) return 0;
    return calculateItemPU(item, budget);
  }, [item, budget]);

  const totalPartida = useMemo(() => {
    if (!item) return 0;
    const qty = parseFloat(item.quantity) || 0;
    return pu * qty;
  }, [item, pu]);

  // Lista de partidas APU reales (excluyendo capítulos)
  const apuItems = useMemo(() => {
    return (budget?.items || []).filter(i => !i.is_chapter);
  }, [budget]);

  const currentApuIndex = apuItems.findIndex(i => i.id === itemId);
  const currentPosition = currentApuIndex !== -1 ? currentApuIndex + 1 : 0;
  const totalApus = apuItems.length;

  const prevItem = currentApuIndex > 0 ? apuItems[currentApuIndex - 1] : null;
  const nextItem = currentApuIndex !== -1 && currentApuIndex < apuItems.length - 1 ? apuItems[currentApuIndex + 1] : null;

  if (loading && (!item || !budget)) {
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
          partida={{
            ...item,
            ...budget,
            fcas_percent: budget.fcas_percent,
            bono_in_fcas: budget.bono_in_fcas,
            labor_bonus: budget.labor_bonus,
            material_inflation: budget.material_inflation,
            equipment_inflation: budget.equipment_inflation,
            labor_inflation: budget.labor_inflation,
            admin_percent: budget.admin_percent,
            util_percent: budget.profit_percent ?? budget.util_percent ?? 10,
            profit_percent: budget.profit_percent ?? budget.util_percent ?? 10,
            rendimiento: item.performance ?? item.rendimiento ?? 1,
            cantidad: item.quantity
          }}
          materiales={item.materials || []}
          equipos={item.equipments || []}
          mano_obra={item.labors || []}
          options={{
            ...printOptions,
            ...budget,
            currency: budget.currency,
            exchange_rate: budget.exchange_rate,
            companyName: budget.company_name || budget.name
          }}
        />
      )}
      
      {printModalOpen && (
        <PrintAPUModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          onPrint={(options) => setPrintOptions(options)}
          budgetName={budget.company_name || ''}
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
            <div className="flex items-center gap-3">
              {/* Indicador de Partida (ej. 1/88, 50/88) */}
              <div 
                className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm"
                title={`Partida ${currentPosition} de ${totalApus} del presupuesto`}
              >
                <Calculator size={16} className="text-blue-600 shrink-0" />
                <span className="text-base md:text-lg font-black text-slate-800 leading-none font-mono">
                  {currentPosition}/{totalApus}
                </span>
              </div>
              
              {/* Navegación APUs */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                <button
                  onClick={() => prevItem && navigate(`/budgets/${id}/item/${prevItem.id}`)}
                  disabled={!prevItem}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={prevItem ? `Ir a APU anterior (${currentPosition - 1}/${totalApus})` : "Este es el primer APU"}
                >
                  <ChevronLeft size={20} className="text-slate-700" />
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button
                  onClick={() => nextItem && navigate(`/budgets/${id}/item/${nextItem.id}`)}
                  disabled={!nextItem}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title={nextItem ? `Ir a siguiente APU (${currentPosition + 1}/${totalApus})` : "Este es el último APU"}
                >
                  <ChevronRight size={20} className="text-slate-700" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Cantidad de la partida en el presupuesto */}
            <div 
              className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm"
              title={`Cantidad presupuestada para esta partida: ${(parseFloat(item?.quantity) || 0).toLocaleString('es-VE')} ${item?.unit || ''}`}
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Cant:
              </span>
              <span className="text-base md:text-lg font-bold text-slate-800 leading-none">
                {(parseFloat(item?.quantity) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {item?.unit && (
                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {item.unit}
                </span>
              )}
            </div>

            {/* Precio unitario del APU */}
            <div 
              className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-emerald-200 shadow-sm"
              title={`Precio unitario del APU: ${pu.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${budget?.currency || 'USD'}`}
            >
              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                P.U:
              </span>
              <span className="text-base md:text-lg font-bold text-emerald-700 leading-none">
                {pu.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                {budget?.currency || 'USD'}
              </span>
            </div>

            {/* Total Partida en vivo (P.U. x Cantidad) */}
            <div 
              className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-blue-200 shadow-sm"
              title={`Total de esta partida: ${(parseFloat(item?.quantity) || 0).toLocaleString('es-VE')} ${item?.unit || 'und'} x ${pu.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            >
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Total Partida:
              </span>
              <span className="text-base md:text-lg font-bold text-blue-700 leading-none">
                {totalPartida.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                {budget?.currency || 'USD'}
              </span>
            </div>

            {/* Total sin IVA en vivo */}
            <div 
              className="hidden sm:flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm"
              title="Total del presupuesto sin IVA (se recalcula automáticamente al modificar este APU)"
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total sin IVA:
              </span>
              <span className="text-base md:text-lg font-bold text-slate-700 leading-none">
                {subtotalPresupuesto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {budget?.currency || 'USD'}
              </span>
            </div>

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
                ...budget,
                currency: budget.currency,
                exchange_rate: budget.exchange_rate,
                fcas_percent: budget.fcas_percent,
                bono_in_fcas: budget.bono_in_fcas,
                labor_bonus: budget.labor_bonus,
                material_inflation: budget.material_inflation,
                equipment_inflation: budget.equipment_inflation,
                labor_inflation: budget.labor_inflation,
                admin_percent: budget.admin_percent,
                profit_percent: budget.profit_percent ?? budget.util_percent ?? 10,
                iva_percent: 0,
                project_name: budget.name,
                client_name: budget.client_name
              }}
            />
          </div>
        </div>

        <div key={item.id} className="animate-in fade-in duration-150">
          <ApuEditorUI
            item={item}
            settings={{
              ...budget,
              currency: budget.currency,
              exchange_rate: budget.exchange_rate ?? 1.0,
              material_inflation: budget.material_inflation ?? 0,
              equipment_inflation: budget.equipment_inflation ?? 0,
              labor_inflation: budget.labor_inflation ?? 0,
              labor_bonus: budget.labor_bonus ?? 0,
              fcas_percent: budget.fcas_percent ?? 417,
              bono_in_fcas: budget.bono_in_fcas,
              admin_percent: budget.admin_percent ?? 15,
              profit_percent: budget.profit_percent ?? budget.util_percent ?? 10,
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
