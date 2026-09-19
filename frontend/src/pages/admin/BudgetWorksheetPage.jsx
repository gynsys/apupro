import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, Settings, Plus, Search, Layers, FileText, Printer,
  DollarSign, Hash, Percent, Loader, X, Trash2, ArrowUp, ArrowDown, FolderPlus, RefreshCw, ChevronDown, Database, GripVertical, Download, Calculator, Calendar
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';
import { budgetService } from '../../services/budgetService';
import { API_URL } from '../../services/api';
import { useDatabaseContext } from '../../contexts/DatabaseContext';
import BudgetSettingsModal from '../../components/modals/BudgetSettingsModal';
import BudgetPrintModal from '../../components/modals/BudgetPrintModal';
import BudgetPrintLayout from '../../components/print/BudgetPrintLayout';
import PrintAPUModal from '../../components/PrintAPUModal';
import PrintAPULayout, { APUPrintSheet } from '../../components/PrintAPULayout';
import SubscriptionRequestModal from '../../components/SubscriptionRequestModal';
import ExportApuExcelButton from '../../modules/costbase/components/ExportApuExcelButton';
import { useCostbaseSearch as useCost360Search } from '../../modules/costbase/hooks/useCostbaseSearch';
import { CostbaseSearchBar as Cost360SearchBar } from '../../modules/costbase/components/CostbaseSearchBar';
import { SiteConfigContext } from '../../App';
import { calculateItemPU, calculateBudgetTotals } from '../../utils/apuCalculations';

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

function MathQuantityInput({ value, onChange, onSave, className }) {
  const formatVal = (v) => {
    if (v === null || v === undefined || v === '') return '0';
    return String(v).replace(/\./g, ',');
  };

  const [localVal, setLocalVal] = useState(() => formatVal(value));
  const [isFocused, setIsFocused] = useState(false);
  const [previewVal, setPreviewVal] = useState(null);

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(formatVal(value));
    }
  }, [value, isFocused]);

  const evaluateExpression = (expr) => {
    if (expr === '' || expr === null || expr === undefined) return 0;
    const str = String(expr).replace(/,/g, '.').trim();
    if (!/^[\d\s+\-*/().]+$/.test(str)) return null;
    try {
      const res = Function(`"use strict"; return (${str})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return Math.max(0, Math.round(res * 10000) / 10000);
      }
    } catch {
      return null;
    }
    return null;
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setLocalVal(text);

    if (/[+\-*/()]/.test(text)) {
      const evalRes = evaluateExpression(text);
      setPreviewVal(evalRes);
    } else {
      setPreviewVal(null);
    }
  };

  const handleCommit = () => {
    setIsFocused(false);
    setPreviewVal(null);

    const evaluated = evaluateExpression(localVal);
    if (evaluated !== null) {
      setLocalVal(formatVal(evaluated));
      if (onChange) onChange(evaluated);
      if (onSave) onSave(evaluated);
    } else {
      setLocalVal(formatVal(value));
      if (localVal && String(localVal).trim() !== '' && String(localVal).trim() !== String(value)) {
        toast.error('Fórmula no válida. Se conservó el valor anterior.', { id: 'math-err', duration: 2000 });
      }
    }
  };

  return (
    <div className="relative inline-flex items-center justify-center w-full">
      <input
        type="text"
        value={isFocused ? localVal : formatVal(value)}
        onFocus={() => {
          setIsFocused(true);
          setLocalVal(formatVal(value));
        }}
        onChange={handleInputChange}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          } else if (e.key === 'Escape') {
            setLocalVal(formatVal(value));
            setIsFocused(false);
            setPreviewVal(null);
            e.target.blur();
          }
        }}
        title="Admite fórmulas matemáticas: ej. 12,5 * 3 o 12.5 * 3. Pulsa Enter para resolver."
        className={className}
      />
      {isFocused && previewVal !== null && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 bg-slate-900 text-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-xl z-30 pointer-events-none whitespace-nowrap flex items-center gap-1 border border-slate-700 animate-in fade-in zoom-in-95">
          <span className="text-slate-400">=</span>
          <span>{previewVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
        </div>
      )}
    </div>
  );
}

export default function BudgetWorksheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [headerDbDropdownOpen, setHeaderDbDropdownOpen] = useState(false);
  const { activeDatabase, setActiveDatabase, databases } = useDatabaseContext();
  const { config } = useContext(SiteConfigContext);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printConfig, setPrintConfig] = useState(null);
  
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [notesText, setNotesText] = useState('');
  
  // APU Print State
  const [apuToPrint, setApuToPrint] = useState(null);
  const [showApuPrintModal, setShowApuPrintModal] = useState(false);
  const [apuPrintOptions, setApuPrintOptions] = useState(null);
  const [configTab, setConfigTab] = useState('general'); // 'general' or 'params'
  const [settings, setSettings] = useState({
    currency: 'USD',
    exchange_rate: 1.0,
    fcas_percent: 417.0,
    admin_percent: 15.0,
    profit_percent: 10.0,
    iva_percent: 16.0,
    labor_bonus: 0.0,
    material_inflation: 0.0,
    labor_inflation: 0.0,
    equipment_inflation: 0.0,
    company_name: '',
    company_rif: '',
    client_name: '',
    project_name: ''
  });

  const [syncing, setSyncing] = useState(false);

  // Search DB Modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const {
    searchQuery, setSearchQuery,
    searchCovenin, setSearchCovenin,
    searchDesc, setSearchDesc,
    searchInsumos, setSearchInsumos,
    results: searchResults,
    totalResults: totalSearchResults,
    isSearching: searching,
    forceSearch: searchDatabase,
    hasMore: hasMoreSearchResults,
    loadMore: loadMoreSearchResults
  } = useCost360Search({
    databaseId: activeDatabase?.id || 'master',
    onlyCoded: config?.forceOnlyCodedMaster === true,
    limit: 30,
    autoSearch: showSearchModal
  });

  // Row selection & Reordering
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Custom modals state
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [modalDbDropdownOpen, setModalDbDropdownOpen] = useState(false);
  const [modalBudgetDropdownOpen, setModalBudgetDropdownOpen] = useState(false);
  const [availableBudgets, setAvailableBudgets] = useState([]);
  const [chapterName, setChapterName] = useState("");
  const [itemToDelete, setItemToDelete] = useState(null);
  const [exportingBudgetExcel, setExportingBudgetExcel] = useState(false);

  const [editingChapterId, setEditingChapterId] = useState(null);
  const [editingChapterName, setEditingChapterName] = useState("");

  useEffect(() => {
    loadBudget();
    if (new URLSearchParams(location.search).get('settings') === 'true') {
      setShowSettings(true);
    }
    // Verificar si se debe imprimir
    if (new URLSearchParams(location.search).get('print') === 'true') {
      // Esperar a que el presupuesto cargue y luego imprimir
      setTimeout(() => {
        const savedConfig = localStorage.getItem(`print_config_${id}`);
        if (savedConfig) {
          setPrintConfig(JSON.parse(savedConfig));
          localStorage.removeItem(`print_config_${id}`);
          setTimeout(() => {
            window.print();
          }, 300);
        }
      }, 500);
    }

    // Cargar presupuestos disponibles para el dropdown del modal
    budgetService.getAll().then(data => setAvailableBudgets(data)).catch(console.error);
  }, [id, location.search]);

  // Handle APU printing
  useEffect(() => {
    const isAllScope = apuPrintOptions?.scope === 'all';
    const shouldPrint = apuPrintOptions && (isAllScope ? budget : apuToPrint);

    if (shouldPrint) {
      const handleAfterPrint = () => {
        setApuPrintOptions(null);
        setApuToPrint(null);
      };
      window.addEventListener('afterprint', handleAfterPrint);

      // Give more time when rendering all APU sheets
      const delay = isAllScope ? 700 : 300;
      const timer = setTimeout(() => {
        window.print();
      }, delay);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [apuPrintOptions, apuToPrint, budget]);

  // Handle Budget printing
  useEffect(() => {
    if (printConfig) {
      const originalTitle = document.title;
      document.title = ''; // Evita que el navegador imprima el titulo en el encabezado

      const handleAfterPrint = () => {
        document.title = originalTitle;
        setPrintConfig(null);
      };
      window.addEventListener('afterprint', handleAfterPrint);
      
      const delay = printConfig.includeAllApus ? 800 : 500;
      const timer = setTimeout(() => {
        window.print();
      }, delay);

      return () => {
        clearTimeout(timer);
        document.title = originalTitle;
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [printConfig]);

  const loadBudget = async () => {
    try {
      setLoading(true);
      const data = await budgetService.getById(id);
      setBudget(data);
      setNotesText(data.notes || '');
      setSettings({
        currency: data.currency || 'USD',
        exchange_rate: data.exchange_rate || 1.0,
        fcas_percent: data.fcas_percent || 417.0,
        admin_percent: data.admin_percent ?? 15.0,
        profit_percent: data.profit_percent ?? 10.0,
        iva_percent: data.iva_percent ?? 16.0,
        labor_bonus: data.labor_bonus ?? 0.0,
        material_inflation: data.material_inflation ?? 0.0,
        labor_inflation: data.labor_inflation ?? 0.0,
        equipment_inflation: data.equipment_inflation ?? 0.0,
        company_name: data.company_name || '',
        company_rif: data.company_rif || '',
        client_name: data.client_name || '',
        project_name: data.project_name || ''
      });
      
      // Verificar si hay configuración de impresión desde la navegación
      if (location.state?.printConfig) {
        setPrintConfig(location.state.printConfig);
        setTimeout(() => {
          window.print();
        }, 300);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error cargando el presupuesto');
      navigate('/budgets');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPrices = () => {
    toast((t) => (
      <div className="flex flex-col gap-3 py-1 min-w-[280px] max-w-sm">
        <p className="text-sm font-medium text-slate-800 leading-snug">
          ¿Deseas actualizar los precios unitarios de TODO el presupuesto usando la Base Maestra? Los rendimientos y cantidades se mantendrán intactos.
        </p>
        <div className="flex justify-end gap-2 mt-1">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                setSyncing(true);
                await budgetService.syncPrices(id);
                toast.success('Precios de todo el presupuesto actualizados correctamente');
                loadBudget();
              } catch (e) {
                toast.error('Error al actualizar precios');
              } finally {
                setSyncing(false);
              }
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            Actualizar
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleOpenSearchModal = () => {
    setShowSearchModal(true);
  };

  const handleAddItem = async (item) => {
    try {
      let targetOrder = 0;
      if (selectedItemId && budget?.items) {
        const selected = budget.items.find(i => i.id === selectedItemId);
        if (selected) targetOrder = selected.order + 1;
      }

      // Cargar el APU completo con los factores de inflación de la base activa
      let materials = [], equipments = [], labors = [];
      try {
        const apuCode = item.CodPar || item.codigo;
        const apuRes = await fetch(`${API_URL}/cost360/items/${apuCode}/apu?database_id=${activeDatabase.id}`);
        if (apuRes.ok) {
          const apuData = await apuRes.json();
          materials = (apuData.materiales || []).map(m => ({
            id: `m-${m.codigo}`,
            codigo: m.codigo,
            descripcion: m.descripcion,
            unidad: m.unidad,
            cantidad: m.cantidad,
            desperdicio: m.desperdicio || 0,
            precio_unitario: m.precio_unitario,
            origen: activeDatabase.is_master ? 'historico' : 'base_personalizada'
          }));
          equipments = (apuData.equipos || []).map(e => ({
            id: `e-${e.codigo}`,
            codigo: e.codigo,
            descripcion: e.descripcion,
            unidad: e.unidad,
            cantidad: e.cantidad,
            depreciacion: e.depreciacion ?? 1.0,
            precio_unitario: e.precio_unitario,
            origen: activeDatabase.is_master ? 'historico' : 'base_personalizada'
          }));
          labors = (apuData.mano_obra || []).map(l => ({
            id: `l-${l.codigo}`,
            codigo: l.codigo,
            descripcion: l.descripcion,
            unidad: l.unidad,
            cantidad: l.cantidad,
            jornal: l.jornal,
            bono: l.bono,
            precio_unitario: l.precio_unitario,
            origen: activeDatabase.is_master ? 'historico' : 'base_personalizada'
          }));
        }
      } catch (apuError) {
        console.error('Error cargando APU:', apuError);
      }

      await budgetService.addItem(id, {
        cod_par: item.CodPar || item.codigo || '',
        cov_par: item.CovPar || '',
        description: item.Descri || item.descripcion || '',
        unit: item.UniPar || item.unidad || 'UND',
        quantity: 1.0,
        performance: item.RenPar || item.rendimiento || 1.0,
        order: targetOrder,
        is_chapter: false,
        materials,
        equipments,
        labors
      });
      setShowSearchModal(false);
      loadBudget();
      toast.success(
        activeDatabase.is_master
          ? 'Partida agregada al presupuesto'
          : `Partida agregada con precios de “${activeDatabase.name}”`
      );
    } catch (error) {
      console.error('Error agregando partida:', error);
      if (error.isLimitError || (error.detail && error.detail.toLowerCase().includes('límite'))) {
        setShowSubscriptionModal(true);
      } else {
        toast.error(error.message || 'Error agregando partida');
      }
    }
  };


  const handleAddChapter = async () => {
    if (!chapterName || !chapterName.trim()) return;
    
    try {
      let targetOrder = 0;
      if (selectedItemId && budget?.items) {
        const selected = budget.items.find(i => i.id === selectedItemId);
        if (selected) targetOrder = selected.order + 1;
      }
      
      await budgetService.addItem(id, {
        cod_par: "CAP",
        cov_par: "",
        description: chapterName.trim().toUpperCase(),
        unit: "",
        quantity: 0.0,
        performance: 1.0,
        order: targetOrder,
        is_chapter: true
      });
      setShowChapterModal(false);
      setChapterName("");
      loadBudget();
      toast.success('Capítulo agregado');
    } catch (error) {
      toast.error('Error agregando capítulo');
    }
  };

  const handleDeleteItem = async (itemId) => {
    setItemToDelete(budget.items.find(i => i.id === itemId));
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await budgetService.deleteItem(id, itemToDelete.id);
      setBudget(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemToDelete.id) }));
      setItemToDelete(null);
      toast.success('Eliminada correctamente');
    } catch (error) {
      toast.error('Error eliminando la fila');
    }
  };

  const handleSaveChapterEdit = async (itemId) => {
    if (!editingChapterName.trim()) {
      setEditingChapterId(null);
      return;
    }
    const finalName = editingChapterName.trim().toUpperCase();
    try {
      await budgetService.updateItem(id, itemId, { description: finalName });
      setBudget(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === itemId ? { ...i, description: finalName } : i)
      }));
      setEditingChapterId(null);
      toast.success('Capítulo actualizado');
    } catch (error) {
      toast.error('Error al actualizar el capítulo');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;

    const newItems = Array.from(budget.items);
    const [reorderedItem] = newItems.splice(sourceIndex, 1);
    newItems.splice(destinationIndex, 0, reorderedItem);
    
    // Update state immediately for UX
    setBudget(prev => ({ ...prev, items: newItems }));
    
    try {
      const itemIds = newItems.map(i => i.id);
      await budgetService.reorderItems(id, itemIds);
    } catch (error) {
      toast.error('Error reordenando las partidas');
      loadBudget(); // Revert on failure
    }
  };

  const handleMoveItem = async (index, direction) => {
    if (!budget?.items) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= budget.items.length) return;

    const newItems = Array.from(budget.items);
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);

    setBudget(prev => ({ ...prev, items: newItems }));

    try {
      const itemIds = newItems.map(i => i.id);
      await budgetService.reorderItems(id, itemIds);
    } catch (error) {
      toast.error('Error al mover la partida');
      loadBudget();
    }
  };

  const calculatePU = (item) => calculateItemPU(item, budget);

  const calculateBudgetTotal = () => calculateBudgetTotals(budget);

  const handleQuantityChange = (itemId, newQuantity) => {
    const parsedQty = typeof newQuantity === 'number' ? newQuantity : parseFloat(String(newQuantity).replace(',', '.')) || 0;
    // Optimistic UI update
    setBudget(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, quantity: parsedQty } : i)
    }));
  };

  const saveQuantity = async (itemId, newQuantity) => {
    try {
      const parsedQty = typeof newQuantity === 'number' ? newQuantity : parseFloat(String(newQuantity).replace(',', '.')) || 0;
      await budgetService.updateItem(budget.id, itemId, { quantity: parsedQty });
    } catch (error) {
      console.error(error);
      toast.error('Error guardando la cantidad');
    }
  };

  const handleSaveNotes = async () => {
    if (!budget) return;
    if ((budget.notes || '') === (notesText || '')) return;
    try {
      await budgetService.update(budget.id, { notes: notesText });
      setBudget(prev => ({ ...prev, notes: notesText }));
    } catch (err) {
      console.error("Error guardando notas:", err);
      toast.error('Error al guardar las notas');
    }
  };

  const handleExportBudgetToExcel = async () => {
    if (!budget) return;
    try {
      setExportingBudgetExcel(true);
      toast.loading('Generando presupuesto en Excel...', { id: 'export-budget-excel' });

      const savedLogo = localStorage.getItem(`budget_logo_${budget.id}`);
      const savedUbicacion = localStorage.getItem(`budget_ubicacion_${budget.id}`) || budget.ubicacion || '';

      const itemsPayload = (budget.items || []).map(item => ({
        id: item.id,
        is_chapter: !!item.is_chapter,
        cod_par: item.cov_par || item.cod_par || '',
        description: item.description || '',
        unit: item.unit || '',
        quantity: parseFloat(item.quantity) || 0,
        pu: item.is_chapter ? 0 : calculatePU(item)
      }));

      const payload = {
        title: 'PRESUPUESTO',
        obra: (budget.project_name || budget.name || '').trim(),
        ubicacion: savedUbicacion.trim(),
        contratante: (budget.client_name || '').trim(),
        company_rif: (budget.company_rif || '').trim(),
        currency: budget.currency || 'USD',
        iva_percent: budget.iva_percent !== undefined && budget.iva_percent !== null ? Number(budget.iva_percent) : 16.0,
        logo_base64: savedLogo || null,
        notes: (notesText !== undefined && notesText !== null ? notesText : budget.notes || '').trim(),
        items: itemsPayload
      };

      await budgetService.exportExcel(budget.id, payload);
      toast.success('Presupuesto exportado a Excel exitosamente', { id: 'export-budget-excel' });
    } catch (err) {
      console.error('Error al exportar presupuesto a Excel:', err);
      toast.error(err.message || 'Error al exportar presupuesto a Excel', { id: 'export-budget-excel' });
    } finally {
      setExportingBudgetExcel(false);
    }
  };

  if (loading || !budget) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <Loader className="animate-spin" size={32} />
      </div>
    );
  }

  const headerPortalTarget = document.getElementById('header-actions-portal');
  const { subtotalPresupuesto, ivaAmount, totalGeneral } = calculateBudgetTotal();

  return (
    <div className="absolute inset-0 p-2 sm:p-4 md:p-6 flex flex-col overflow-hidden w-full max-w-7xl mx-auto no-print">
      {/* WORKSHEET CONTENT */}
      <div className="flex-1 flex flex-col relative min-h-0">

      {/* SETTINGS MODAL */}
      {showSettings && (
        <BudgetSettingsModal
          budget={budget}
          onClose={() => {
            setShowSettings(false);
            if (new URLSearchParams(location.search).has('settings')) {
              navigate(`/budgets/${id}`, { replace: true });
            }
          }}
          onSave={(newSettings) => {
            setBudget(prev => ({ 
              ...prev, 
              ...newSettings,
              name: newSettings.name || newSettings.project_name || prev.name,
              project_name: newSettings.project_name || newSettings.name || prev.project_name
            }));
            setShowSettings(false);
            if (new URLSearchParams(location.search).has('settings')) {
              navigate(`/budgets/${id}`, { replace: true });
            }
          }}
        />
      )}

      {/* PRINT MODAL */}
      {showPrintModal && (
        <BudgetPrintModal 
          onClose={() => setShowPrintModal(false)}
          onPrint={(config) => {
            setShowPrintModal(false);
            setPrintConfig(config);
          }}
          initialCurrency={budget.currency || 'USD'}
          initialUbicacion={budget.ubicacion || ''}
          budgetId={id}
        />
      )}
      
      {/* PRINT LAYOUT (Hidden from screen via CSS, only visible when printing) */}
      {printConfig && (
        <BudgetPrintLayout 
          budget={budget}
          config={printConfig}
        />
      )}

      {/* APU PRINT MODAL */}
      {showApuPrintModal && apuToPrint && (
        <PrintAPUModal
          isOpen={showApuPrintModal}
          onClose={() => { setShowApuPrintModal(false); setApuToPrint(null); }}
          onPrint={(options) => {
            setShowApuPrintModal(false);
            setApuPrintOptions(options);
          }}
          budgetName={budget.company_name || ''}
        />
      )}


      {/* APU PRINT LAYOUT — Ficha individual */}
      {apuPrintOptions && apuPrintOptions.scope !== 'all' && apuToPrint && (
        <PrintAPULayout
          partida={{ 
            ...apuToPrint, 
            fcas_percent: budget.fcas_percent, 
            admin_percent: budget.admin_percent, 
            util_percent: budget.profit_percent, 
            rendimiento: apuToPrint.performance, 
            cantidad: apuToPrint.quantity 
          }}
          materiales={apuToPrint.materials || []}
          equipos={apuToPrint.equipments || []}
          mano_obra={apuToPrint.labors || []}
          options={{ ...apuPrintOptions, companyName: budget.company_name || budget.project_name || budget.name }}
        />
      )}

      {/* APU PRINT LAYOUT — Todos los APU del presupuesto */}
      {apuPrintOptions && apuPrintOptions.scope === 'all' && budget && createPortal(
        <div
          id="print-apu-layout"
          className="print-only"
          style={{
            display: 'none',
            backgroundColor: '#fff',
            color: '#000',
            fontFamily: 'Arial, sans-serif',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {(budget.items || []).filter(i => !i.is_chapter).map((item, idx) => (
            <div
              key={item.id || idx}
              style={{
                pageBreakBefore: idx === 0 ? 'auto' : 'always',
                breakBefore: idx === 0 ? 'auto' : 'page',
                paddingTop: idx === 0 ? 0 : '10mm',
                boxSizing: 'border-box',
              }}
            >
              <APUPrintSheet
                partida={{
                  ...item,
                  fcas_percent: budget.fcas_percent,
                  admin_percent: budget.admin_percent,
                  util_percent: budget.profit_percent,
                  rendimiento: item.performance ?? item.rendimiento ?? 1,
                  cantidad: item.quantity,
                  obra: budget.project_name || budget.name || '',
                  contratante: budget.client_name || '',
                }}
                materiales={item.materials || []}
                equipos={item.equipments || []}
                mano_obra={item.labors || []}
                options={{
                  ...apuPrintOptions,
                  companyName: budget.company_name || budget.project_name || budget.name,
                  admin_percent: budget.admin_percent,
                  profit_percent: budget.profit_percent,
                  fcas_percent: budget.fcas_percent,
                  obra: budget.project_name || budget.name || '',
                  contratante: budget.client_name || '',
                }}
              />
            </div>
          ))}
        </div>,
        document.body
      )}


      {/* WORKSHEET CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 flex flex-col relative overflow-hidden">
        {/* WORKSHEET HEADER BAR */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            {/* Project Name + Back Button */}
            <div className="flex items-center justify-between w-full md:w-auto gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button 
                  onClick={() => navigate('/budgets')}
                  className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm shrink-0"
                  title="Volver a presupuestos"
                >
                  <ArrowLeft size={20} className="text-slate-600" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-bold text-slate-800 leading-tight truncate">
                    {budget.project_name || budget.name}
                  </h1>
                </div>
              </div>
              <div className="flex md:hidden items-center shrink-0 gap-1.5">
                <span className="text-xs text-slate-600 font-bold bg-slate-100 px-2 py-1 rounded-lg">
                  {budget.items.filter(item => !item.is_chapter).length} part.
                </span>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
                  title="Configuración Global"
                >
                  <Settings size={17} />
                </button>
                <button 
                  onClick={() => setShowPrintModal(true)}
                  className="p-1.5 bg-white border border-amber-200 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors shadow-xs"
                  title="Imprimir Presupuesto"
                >
                  <Printer size={17} />
                </button>
              </div>
            </div>

            {/* Total Partidas count (Desktop) */}
            <div className="hidden md:flex items-center">
              <span className="text-sm text-black font-bold">
                Total Partidas: {budget.items.filter(item => !item.is_chapter).length}
              </span>
            </div>

            {/* Topbar Actions Portal */}
            {headerPortalTarget && createPortal(
              <div className="flex gap-2 mx-2">
                {/* Database Selector Dropdown */}
                <div 
                  className="relative"
                  onMouseEnter={() => setHeaderDbDropdownOpen(true)}
                  onMouseLeave={() => setHeaderDbDropdownOpen(false)}
                >
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm text-sm"
                  >
                    <Database size={16} />
                    Base de Datos
                    <ChevronDown size={14} className={headerDbDropdownOpen ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                  </button>
                  {headerDbDropdownOpen && (
                    <div className="absolute top-full left-0 pt-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="bg-white border border-slate-200 rounded-lg shadow-xl min-w-[200px] overflow-hidden py-1">
                        {databases.map(db => (
                          <button
                            key={db.id}
                            onClick={() => {
                              setActiveDatabase(db);
                              setHeaderDbDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                              activeDatabase.id === db.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                            }`}
                          >
                            <Database size={14} />
                            {db.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button 
                  onClick={handleSyncPrices}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors font-medium shadow-sm text-sm"
                >
                  <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Actualizando...' : 'Actualizar Precios'}
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm text-sm"
                >
                  <Settings size={16} /> Configuración Global
                </button>
                <button 
                  onClick={() => setShowPrintModal(true)}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl hover:bg-amber-50 transition-colors font-medium shadow-sm text-sm"
                >
                  <Printer size={16} /> Imprimir
                </button>
              </div>,
              headerPortalTarget
            )}

            {/* Action Buttons: Partidas, Capítulos, Excel, Configuración, Imprimir */}
            <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button  
                onClick={handleOpenSearchModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 sm:py-2 rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all active:scale-95 text-sm"
              >
                <Plus size={18} /> Agregar Partida
              </button>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                <button  
                  onClick={() => { setChapterName(""); setShowChapterModal(true); }}
                  className="flex items-center justify-center gap-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-xl font-medium shadow-xs transition-all text-xs sm:text-sm"
                >
                  <FolderPlus size={16} className="shrink-0" /> <span className="truncate">Agregar Capítulo</span>
                </button>

                <button
                  onClick={handleExportBudgetToExcel}
                  disabled={exportingBudgetExcel}
                  className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 px-3 py-2 rounded-xl font-medium shadow-xs transition-all disabled:opacity-50 text-xs sm:text-sm"
                  title="Exportar presupuesto a Excel"
                >
                  {exportingBudgetExcel ? (
                    <Loader size={16} className="animate-spin text-emerald-600 shrink-0" />
                  ) : (
                    <ExcelIcon size={16} className="text-emerald-600 shrink-0" />
                  )}
                  <span className="truncate">Exportar Excel</span>
                </button>

                <button
                  onClick={() => navigate(`/budgets/${id}/schedule`)}
                  className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-700 hover:text-red-800 hover:bg-red-50 hover:border-red-300 px-3 py-2 rounded-xl font-medium shadow-xs transition-all text-xs sm:text-sm"
                  title="Planificación y Cronograma de Obra (CPM / Gantt)"
                >
                  <Calendar size={16} className="text-red-600 shrink-0" />
                  <span className="truncate">Cronograma CPM</span>
                </button>

                {/* VISIBLES EN MÓVIL (< md) */}
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="md:hidden flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl font-medium shadow-xs transition-all text-xs"
                >
                  <Settings size={16} className="shrink-0 text-slate-600" /> <span className="truncate">Configuración</span>
                </button>

                <button 
                  onClick={() => setShowPrintModal(true)}
                  className="md:hidden flex items-center justify-center gap-2 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-2 rounded-xl font-medium shadow-xs transition-all text-xs"
                >
                  <Printer size={16} className="shrink-0 text-amber-600" /> <span className="truncate">Imprimir</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* WORKSHEET BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto min-h-0 relative">
          {/* MOBILE VIEW (< md): TARJETAS NATIVAS */}
          <div className="md:hidden p-3 space-y-3">
            {budget.items.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 my-4">
                <Layers className="mx-auto mb-3 text-slate-300" size={36} />
                <p className="text-sm font-medium">No hay partidas en este presupuesto.</p>
                <button 
                  onClick={handleOpenSearchModal}
                  className="mt-3 text-blue-600 font-semibold hover:underline text-sm inline-flex items-center gap-1"
                >
                  <Plus size={16} /> Buscar e incluir la primera partida
                </button>
              </div>
            ) : (
              (() => {
                let mobileItemNumber = 0;
                return budget.items.map((item, idx) => {
                  const isSelected = selectedItemId === item.id;

                  if (item.is_chapter) {
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                        className={`rounded-xl px-3 py-1.5 shadow-xs border transition-all flex items-center justify-between gap-2 min-h-[34px] ${
                          isSelected 
                            ? 'bg-[#fef3c7] ring-2 ring-amber-500 border-[#f59e0b]' 
                            : 'bg-[#fef3c7] border-[#f59e0b] hover:bg-amber-200/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <button 
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveItem(idx, 'up')}
                              className="p-1 text-amber-800 hover:text-amber-950 disabled:opacity-20 rounded hover:bg-amber-200/80 active:scale-95 transition-all"
                              title="Subir capítulo"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button 
                              type="button"
                              disabled={idx === budget.items.length - 1}
                              onClick={() => handleMoveItem(idx, 'down')}
                              className="p-1 text-amber-800 hover:text-amber-950 disabled:opacity-20 rounded hover:bg-amber-200/80 active:scale-95 transition-all"
                              title="Bajar capítulo"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                          
                          {editingChapterId === item.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingChapterName}
                              onChange={e => setEditingChapterName(e.target.value)}
                              onBlur={() => handleSaveChapterEdit(item.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveChapterEdit(item.id);
                                if (e.key === 'Escape') setEditingChapterId(null);
                              }}
                              className="w-full bg-white border border-amber-500 rounded px-2 py-0.5 text-[#78350f] font-bold uppercase text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingChapterId(item.id);
                                setEditingChapterName(item.description);
                              }}
                              className="font-bold text-xs uppercase tracking-wider text-[#78350f] truncate cursor-pointer"
                              title="Tocar para editar capítulo"
                            >
                              {item.description}
                            </span>
                          )}
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          className="p-1 text-amber-800 hover:text-red-600 hover:bg-amber-200/80 rounded-lg transition-colors shrink-0"
                          title="Eliminar capítulo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  }

                  mobileItemNumber++;
                  const currentNumber = mobileItemNumber;
                  const pu = calculatePU(item);
                  const qty = parseFloat(item.quantity) || 0;
                  const total = Math.round((pu * qty + Number.EPSILON) * 100) / 100;

                  return (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                      className={`bg-white rounded-2xl border transition-all p-3.5 space-y-2.5 shadow-sm ${
                        isSelected ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* FILA 1: Identificación y Reordenamiento */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Número de partida y Botones de Movimiento */}
                          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80 shrink-0" onClick={e => e.stopPropagation()}>
                            <span className="text-xs font-bold text-slate-700 px-1.5 min-w-[20px] text-center">
                              {currentNumber}
                            </span>
                            <div className="flex flex-col border-l border-slate-200 pl-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveItem(idx, 'up')}
                                className="p-0.5 text-slate-500 hover:text-blue-600 disabled:opacity-20 hover:bg-slate-200 rounded active:scale-95 transition-all"
                                title="Mover arriba"
                              >
                                <ArrowUp size={11} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === budget.items.length - 1}
                                onClick={() => handleMoveItem(idx, 'down')}
                                className="p-0.5 text-slate-500 hover:text-blue-600 disabled:opacity-20 hover:bg-slate-200 rounded active:scale-95 transition-all"
                                title="Mover abajo"
                              >
                                <ArrowDown size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Código Covenin o Interno */}
                          <span className="font-mono font-bold text-[11px] text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200/70 truncate">
                            {item.cov_par || item.cod_par || 'S/C'}
                          </span>
                        </div>

                        {/* Unidad */}
                        <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/60 shrink-0">
                          {item.unit || 'UND'}
                        </span>
                      </div>

                      {/* FILA 2: Descripción */}
                      <div className="text-xs text-slate-800 font-medium leading-relaxed line-clamp-3">
                        {item.description}
                      </div>

                      {/* FILA 3: Cálculos (3 columnas: Cantidad, P.U., Total) */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                        {/* Cantidad editable */}
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center mb-1 flex items-center justify-center gap-1">
                            <Calculator size={10} className="text-amber-600 shrink-0" />
                            Cant.
                          </span>
                          <MathQuantityInput 
                            className="w-full text-center bg-white border border-slate-200 focus:border-blue-500 rounded-lg py-1 px-1 font-mono text-xs font-bold text-slate-900 shadow-inner"
                            value={item.quantity}
                            onChange={val => handleQuantityChange(item.id, val)}
                            onSave={val => saveQuantity(item.id, val)}
                          />
                        </div>

                        {/* P.U. */}
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col justify-between text-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            P.U.
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-800 py-1 truncate">
                            {pu.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Total */}
                        <div className="bg-blue-50/70 p-2 rounded-xl border border-blue-200 flex flex-col justify-between text-center">
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
                            Total
                          </span>
                          <span className="font-mono text-xs font-extrabold text-blue-900 py-1 truncate">
                            {total.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* FILA 4: STRICTLY ONLY ICONS (NO TEXT) */}
                      <div className="grid grid-cols-4 gap-2 pt-1.5 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                        <button 
                          type="button"
                          onClick={() => navigate(`/budgets/${budget.id}/item/${item.id}`)} 
                          className="p-2.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center"
                          title="Editar APU"
                        >
                          <Settings size={18} />
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => { setApuToPrint(item); setShowApuPrintModal(true); }} 
                          className="p-2.5 text-slate-600 hover:text-green-600 hover:bg-green-50 active:bg-green-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center"
                          title="Imprimir APU"
                        >
                          <Printer size={18} />
                        </button>
                        
                        <ExportApuExcelButton 
                          item={item} 
                          materials={item.materials || []}
                          equipments={item.equipments || []}
                          labors={item.labors || []}
                          settings={budget.settings}
                          className="p-2.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center w-full"
                          iconSize={18}
                        />
                        
                        <button 
                          type="button"
                          onClick={() => handleDeleteItem(item.id)} 
                          className="p-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 active:bg-red-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>

          {/* DESKTOP VIEW (>= md): TABLA SPREADSHEET */}
          <div className="hidden md:block">
            <DragDropContext onDragEnd={handleDragEnd}>
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-30 shadow-md ring-1 ring-slate-200 bg-white">
                  {/* COLUMN HEADERS */}
                  <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold shadow-sm">
                  <th className="p-4 w-16 text-center bg-slate-50 border-b border-slate-200">#</th>
                  <th className="p-4 w-32 bg-slate-50 border-b border-slate-200">Código</th>
                  <th className="p-4 bg-slate-50 border-b border-slate-200">Descripción</th>
                  <th className="p-4 w-20 text-center bg-slate-50 border-b border-slate-200">Unidad</th>
                  <th className="p-4 w-28 text-center bg-slate-50 border-b border-slate-200">
                    <div className="inline-flex items-center justify-center gap-1.5 group/th relative cursor-help w-full">
                      <Calculator size={13} className="text-amber-600 hover:text-amber-700 transition-colors shrink-0" />
                      <span>Cantidad</span>
                      
                      {/* Tooltip flotante con paleta ámbar de tarjeta de presupuesto */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/th:flex flex-col w-64 p-3.5 bg-[#fef3c7] text-[#78350f] text-[11px] rounded-2xl shadow-xl z-50 pointer-events-none normal-case font-normal leading-relaxed border-2 border-[#f59e0b] animate-in fade-in zoom-in-95 text-left">
                        <p className="font-semibold text-amber-950 text-[11px]">
                          Puedes escribir operaciones matemáticas básicas directamente:
                        </p>
                        <div className="mt-2 font-mono text-[11px] text-amber-900 bg-amber-100/80 border border-amber-300/80 p-2.5 rounded-xl space-y-1 font-semibold">
                          <div>• 12.5 * 3</div>
                          <div>• (4.5 + 3.2) * 2.60</div>
                          <div>• 100 / 4 + 15</div>
                        </div>
                        <span className="text-[10px] text-amber-800/80 mt-2 italic font-medium">Pulsa Enter o sal del campo para resolver automáticamente.</span>
                      </div>
                    </div>
                  </th>
                  <th className="p-4 w-24 text-right bg-slate-50 border-b border-slate-200">P.U.</th>
                  <th className="p-4 w-32 text-right bg-slate-50 border-b border-slate-200">Total</th>
                  <th className="p-4 w-32 text-center bg-slate-50 border-b border-slate-200">Acciones</th>
                </tr>
              </thead>
              <Droppable droppableId="budget-items">
                {(provided) => (
                  <tbody 
                    className="divide-y divide-slate-100"
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    {budget.items.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-12 text-center text-slate-500">
                          <Layers className="mx-auto mb-3 text-slate-300" size={32} />
                          <p>No hay partidas en este presupuesto.</p>
                          <button 
                            onClick={handleOpenSearchModal}
                            className="mt-4 text-blue-600 font-medium hover:underline"
                          >
                            Buscar e incluir la primera partida
                          </button>
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        let itemNumber = 0;
                        return (
                          <>
                            {budget.items.map((item, idx) => {
                              const isSelected = selectedItemId === item.id;
                              
                              if (item.is_chapter) {
                                return (
                                  <Draggable key={item.id} draggableId={item.id} index={idx}>
                                    {(provided, snapshot) => (
                                      <tr 
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                                        className={`hover:bg-[#FEF3C7] transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/50 ring-inset ring-2 ring-blue-500/50' : 'bg-slate-100/50'} ${snapshot.isDragging ? 'shadow-lg ring-1 ring-blue-400 bg-white z-50 relative' : ''}`}
                                      >
                                        <td className="p-4 text-center">
                                          <div {...provided.dragHandleProps} className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-200/50 transition-colors">
                                            <GripVertical size={16} />
                                          </div>
                                        </td>
                                        <td 
                                          colSpan="6" 
                                          className="p-4 text-sm font-bold text-slate-900 tracking-wide uppercase"
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setEditingChapterId(item.id);
                                            setEditingChapterName(item.description);
                                          }}
                                        >
                                          {editingChapterId === item.id ? (
                                            <input
                                              autoFocus
                                              type="text"
                                              value={editingChapterName}
                                              onChange={e => setEditingChapterName(e.target.value)}
                                              onBlur={() => handleSaveChapterEdit(item.id)}
                                              onKeyDown={e => {
                                                if (e.key === 'Enter') handleSaveChapterEdit(item.id);
                                                if (e.key === 'Escape') setEditingChapterId(null);
                                              }}
                                              className="w-full bg-white border border-blue-400 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-bold uppercase"
                                              onClick={e => e.stopPropagation()}
                                            />
                                          ) : (
                                            <div title="Doble clic para editar" className="w-full h-full">
                                              {item.description}
                                            </div>
                                          )}
                                        </td>
                                        <td className="p-4 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors" title="Eliminar">
                                              <Trash2 size={16} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Draggable>
                                );
                              }

                              itemNumber++;
                              const currentNumber = itemNumber;
                              return (
                                <Draggable key={item.id} draggableId={item.id} index={idx}>
                                  {(provided, snapshot) => (
                                    <tr 
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                                      className={`hover:bg-[#FEF3C7] transition-colors duration-200 cursor-pointer group ${isSelected ? 'bg-blue-50 ring-inset ring-2 ring-blue-400' : ''} ${snapshot.isDragging ? 'shadow-xl ring-1 ring-blue-500 bg-white z-50 relative' : ''}`}
                                    >
                                      <td className="p-4 text-center">
                                        <div {...provided.dragHandleProps} className="inline-flex items-center justify-center p-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-200/50 transition-colors w-8 h-8">
                                          <span className="text-slate-500 font-bold text-sm group-hover:hidden">{currentNumber}</span>
                                          <GripVertical size={16} className="hidden group-hover:block text-slate-400 hover:text-blue-600" />
                                        </div>
                                      </td>
                                      <td className="p-4 text-sm font-mono text-slate-600">{item.cov_par || item.cod_par}</td>
                                    <td className="p-4 text-sm text-slate-800">
                                      <div className="line-clamp-2 leading-relaxed" title={item.description}>
                                        {item.description}
                                      </div>
                                    </td>
                                    <td className="p-4 text-center text-sm font-medium text-slate-500">{item.unit}</td>
                                    <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                      <MathQuantityInput 
                                        className="w-full text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors font-mono text-sm font-semibold text-slate-800"
                                        value={item.quantity}
                                        onChange={val => handleQuantityChange(item.id, val)}
                                        onSave={val => saveQuantity(item.id, val)}
                                      />
                                    </td>
                                    <td className="p-4 text-right text-sm font-medium text-slate-700">
                                      {calculatePU(item).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-right text-sm font-bold text-slate-900">
                                      {(Math.round((calculatePU(item) * (parseFloat(item.quantity) || 0) + Number.EPSILON) * 100) / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <button onClick={(e) => { e.stopPropagation(); navigate(`/budgets/${budget.id}/item/${item.id}`); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-colors" title="Editar APU">
                                            <Settings size={16} />
                                          </button>
                                          <button onClick={(e) => { e.stopPropagation(); setApuToPrint(item); setShowApuPrintModal(true); }} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-colors" title="Imprimir APU">
                                            <Printer size={16} />
                                          </button>
                                          <ExportApuExcelButton 
                                            item={item} 
                                            materials={item.materials || []}
                                            equipments={item.equipments || []}
                                            labors={item.labors || []}
                                            settings={budget.settings}
                                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-colors"
                                            iconSize={16}
                                          />
                                          <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors" title="Eliminar">
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </td>
                                  </tr>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </>
                        );
                      })()
                    )}
                  </tbody>
                )}
              </Droppable>
            </table>
          </DragDropContext>
          </div>
        </div>
        </div>
        
        {/* FOOTER: NOTAS & TOTAL */}
        {budget.items?.length > 0 && (
          <div className="mt-2.5 sm:mt-4 flex-none">
            {/* MOBILE COMPACT TOTALS & NOTES (< md) */}
            <div className="md:hidden flex flex-col gap-2">
              {/* Notas compactas en móvil */}
              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  onBlur={handleSaveNotes}
                  placeholder="Notas u observaciones del presupuesto..."
                  rows={1}
                  className="w-full bg-transparent border-0 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none leading-normal"
                />
              </div>

              {/* Barra compacta de totales (3 columnas, altura reducida a menos de la mitad) */}
              <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">SUBTOTAL</span>
                  <span className="font-mono font-bold text-slate-700 text-xs leading-none">
                    {subtotalPresupuesto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex flex-col text-center px-2 border-x border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">I.V.A. ({budget.iva_percent ?? 16}%)</span>
                  <span className="font-mono font-bold text-slate-700 text-xs leading-none">
                    {ivaAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider leading-none mb-0.5">TOTAL ({budget.currency})</span>
                  <span className="font-mono font-extrabold text-blue-900 text-sm leading-none">
                    {totalGeneral.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* DESKTOP TOTALS & NOTES (>= md) */}
            <div className="hidden md:flex flex-row items-stretch md:items-start justify-between gap-6">
              {/* ÁREA DE NOTAS */}
              <div className="flex-1 max-w-2xl bg-white p-3 rounded-2xl border border-slate-300 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  onBlur={handleSaveNotes}
                  placeholder="Escribe notas, observaciones, términos de validez o condiciones de pago..."
                  rows={2}
                  className="w-full bg-transparent border-0 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* TABLA DE TOTALES */}
              <div className="bg-slate-50 px-4 py-2 rounded-2xl border-2 border-slate-300 shadow-sm w-full md:w-auto md:min-w-[300px] shrink-0">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium text-sm leading-none">SUBTOTAL</span>
                  <span className="text-[14px] font-semibold text-slate-700 leading-none">
                    {subtotalPresupuesto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium text-sm leading-none">I.V.A. ({budget.iva_percent ?? 16}%)</span>
                  <span className="text-[14px] font-semibold text-slate-700 leading-none">
                    {ivaAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium text-sm leading-none">TOTAL ({budget.currency})</span>
                  <span className="text-[14px] font-bold text-slate-800 leading-none">
                    {totalGeneral.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* SEARCH MODAL */}
      {showSearchModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-0 sm:p-4 sm:pt-20">
          <div className="w-full h-full sm:h-[80vh] sm:max-w-4xl bg-amber-100 rounded-none sm:rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-wrap sm:flex-nowrap justify-between items-center px-4 sm:px-6 py-3 sm:py-4 bg-white/40 border-b border-amber-600/15 gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <h2 className="m-0 text-lg sm:text-xl font-bold text-amber-900 flex items-center gap-2">
                  <Search className="text-sky-600" size={20} /> Buscar Partidas
                </h2>
                
                <div className="flex gap-2">
                  {/* Dropdown Base de Datos */}
                  <div 
                    className="relative"
                    onMouseEnter={() => setModalDbDropdownOpen(true)}
                    onMouseLeave={() => setModalDbDropdownOpen(false)}
                  >
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm text-xs sm:text-sm"
                    >
                      <Database size={14} />
                      <span className="max-w-[100px] truncate">{activeDatabase.name || 'Base de Datos'}</span>
                      <ChevronDown size={14} className={modalDbDropdownOpen ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                    </button>
                    {modalDbDropdownOpen && (
                      <div className="absolute top-full left-0 pt-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="bg-white border border-slate-200 rounded-lg shadow-xl min-w-[200px] overflow-hidden py-1">
                          {databases.map(db => (
                            <button
                              key={db.id}
                              onClick={() => {
                                setActiveDatabase(db);
                                setSearchQuery('');
                                setSearchCovenin('');
                                setModalDbDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 ${
                                activeDatabase.id === db.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                              }`}
                            >
                              <Database size={14} />
                              {db.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dropdown Presupuestos */}
                  <div 
                    className="relative"
                    onMouseEnter={() => setModalBudgetDropdownOpen(true)}
                    onMouseLeave={() => setModalBudgetDropdownOpen(false)}
                  >
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm text-xs sm:text-sm"
                    >
                      <FileText size={14} />
                      Presupuestos
                      <ChevronDown size={14} className={modalBudgetDropdownOpen ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                    </button>
                    {modalBudgetDropdownOpen && (
                      <div className="absolute top-full left-0 pt-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="bg-white border border-slate-200 rounded-lg shadow-xl min-w-[200px] overflow-hidden py-1 max-h-60 overflow-y-auto">
                          {availableBudgets.filter(b => b.id !== id).map(b => (
                            <button
                              key={b.id}
                              onClick={() => {
                                setActiveDatabase({ id: 'budget_' + b.id, name: b.name, is_budget: true });
                                setSearchQuery('');
                                setSearchCovenin('');
                                setModalBudgetDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                            >
                              <FileText size={14} className="text-slate-400" />
                              <span className="truncate">{b.name}</span>
                            </button>
                          ))}
                          {availableBudgets.length <= 1 && (
                            <div className="px-4 py-3 text-sm text-slate-500 italic text-center">
                              No hay otros presupuestos
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSearchCovenin('');
                  setShowSearchModal(false);
                }}
                className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1.5 rounded-lg hover:bg-amber-200/50"
              >
                <X size={22} />
              </button>
            </div>
            
            {!activeDatabase.is_budget && (
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-amber-600/15 bg-white/40">
                <Cost360SearchBar
                  key={activeDatabase.id}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchCovenin={searchCovenin}
                  setSearchCovenin={setSearchCovenin}
                  searchDesc={searchDesc}
                  setSearchDesc={setSearchDesc}
                  searchInsumos={searchInsumos}
                  setSearchInsumos={setSearchInsumos}
                  isSearching={searching}
                  onSearch={searchDatabase}
                />

                {totalSearchResults > 0 && (
                  <p className="mt-2 text-xs text-slate-500 font-medium">
                    <span className="font-bold text-slate-700">{new Intl.NumberFormat('es-VE').format(totalSearchResults)}</span>{' '}
                    {(searchQuery || searchCovenin) ? (totalSearchResults === 1 ? 'coincidencia' : 'coincidencias') : (totalSearchResults === 1 ? 'Partida' : 'Partidas')}
                  </p>
                )}
              </div>
            )}

            <div className="overflow-y-auto p-3 sm:p-4 flex-1 bg-white/20">
              {searchResults.length === 0 && !searching ? (
                <div className="text-center py-12 text-amber-700/70 text-sm font-medium">
                  No se encontraron partidas.
                </div>
              ) : (
                <div className="space-y-2.5 sm:space-y-3">
                  {searchResults.map(item => (
                    <div 
                      key={item.CodPar}
                      className="bg-white/80 border border-amber-600/10 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-2.5 sm:gap-4 hover:border-sky-300 hover:shadow-md transition-all items-start sm:items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            {item.CovPar || item.CodPar}
                          </span>
                          <span className="text-[11px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                            UND: {item.UniPar}
                          </span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-amber-950 line-clamp-2 leading-relaxed m-0">
                          {item.Descri}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleAddItem(item)}
                        className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 bg-transparent border border-sky-200 hover:border-sky-500 hover:bg-sky-50 text-sky-700 px-4 py-2 sm:py-1.5 rounded-lg font-semibold transition-colors text-xs active:scale-95"
                      >
                        <Plus size={14} /> Incluir
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {hasMoreSearchResults && !searching && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => loadMoreSearchResults()}
                    className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2 rounded-xl text-sm font-semibold shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:-translate-y-[1px]"
                  >
                    Cargar más...
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      <SubscriptionRequestModal 
        isOpen={showSubscriptionModal} 
        onClose={() => setShowSubscriptionModal(false)}
        limitType="apu"
      />
      {/* CHAPTER MODAL */}
      {showChapterModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-full sm:max-w-[550px] bg-amber-100 rounded-t-3xl sm:rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col gap-2 px-6 pt-6 pb-2">
              <h2 className="m-0 text-xl font-bold text-amber-900 flex items-center gap-2">
                <FolderPlus className="text-sky-600" size={24} />
                Agregar Capítulo
              </h2>
            </div>
            <div className="px-6 pb-6 pt-2 flex flex-col gap-4">
              <input 
                type="text" 
                autoFocus
                value={chapterName}
                onChange={(e) => setChapterName(e.target.value)}
                placeholder="Ej. Movimiento de Tierras"
                className="px-4 py-2.5 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddChapter();
                }}
              />
              <div className="flex justify-end gap-3 mt-2">
                <button 
                  onClick={() => { setShowChapterModal(false); setChapterName(""); }}
                  className="bg-transparent border-none text-amber-700 text-sm font-semibold px-5 py-2.5 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAddChapter}
                  className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2.5 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE CONFIRM MODAL */}
      {itemToDelete && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-full sm:max-w-sm shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-14 sm:w-16 h-14 sm:h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Trash2 className="text-red-600" size={28} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">Eliminar {itemToDelete.is_chapter ? 'capítulo' : 'partida'}</h3>
            <p className="text-slate-500 mb-6 sm:mb-8 text-xs sm:text-sm leading-relaxed">
              ¿Estás seguro de que deseas eliminar este elemento del presupuesto? Esta acción actualizará los totales y no se puede deshacer.
            </p>
            <div className="flex flex-col gap-2.5 sm:gap-3">
              <button 
                onClick={confirmDelete}
                className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors w-full shadow-lg shadow-red-500/30 text-sm"
              >
                Sí, eliminar
              </button>
              <button 
                onClick={() => setItemToDelete(null)}
                className="px-5 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors w-full text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
