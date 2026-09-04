import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, Settings, Plus, Search, Layers, FileText, Printer,
  DollarSign, Hash, Percent, Loader, X, Trash2, ArrowUp, ArrowDown, FolderPlus, RefreshCw, ChevronDown, Database, GripVertical, Download, Calculator
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
import PrintAPULayout from '../../components/PrintAPULayout';
import SubscriptionRequestModal from '../../components/SubscriptionRequestModal';
import ExportApuExcelButton from '../../modules/cost360/components/ExportApuExcelButton';
import { useCost360Search } from '../../modules/cost360/hooks/useCost360Search';
import Cost360SearchBar from '../../modules/cost360/components/Cost360SearchBar';
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
  const [localVal, setLocalVal] = useState(value ?? 0);
  const [isFocused, setIsFocused] = useState(false);
  const [previewVal, setPreviewVal] = useState(null);

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(value ?? 0);
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
      setLocalVal(evaluated);
      if (onChange) onChange(evaluated);
      if (onSave) onSave(evaluated);
    } else {
      setLocalVal(value ?? 0);
      if (localVal && String(localVal).trim() !== '' && String(localVal).trim() !== String(value)) {
        toast.error('Fórmula no válida. Se conservó el valor anterior.', { id: 'math-err', duration: 2000 });
      }
    }
  };

  return (
    <div className="relative inline-flex items-center justify-end w-full">
      <input
        type="text"
        value={localVal}
        onFocus={() => setIsFocused(true)}
        onChange={handleInputChange}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          } else if (e.key === 'Escape') {
            setLocalVal(value ?? 0);
            setIsFocused(false);
            setPreviewVal(null);
            e.target.blur();
          }
        }}
        title="Admite fórmulas matemáticas: ej. 12.5 * 3, (4.5+3.2)*2.6, 100/4. Pulsa Enter para resolver."
        className={className}
      />
      {isFocused && previewVal !== null && (
        <div className="absolute right-0 bottom-full mb-1.5 bg-slate-900 text-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-xl z-30 pointer-events-none whitespace-nowrap flex items-center gap-1 border border-slate-700 animate-in fade-in zoom-in-95">
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
    if (apuPrintOptions && apuToPrint) {
      const handleAfterPrint = () => {
        setApuPrintOptions(null);
        setApuToPrint(null);
      };
      window.addEventListener('afterprint', handleAfterPrint);
      
      setTimeout(() => {
        window.print();
      }, 300);

      return () => {
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [apuPrintOptions, apuToPrint]);

  // Handle Budget printing
  useEffect(() => {
    if (printConfig) {
      const handleAfterPrint = () => {
        setPrintConfig(null);
      };
      window.addEventListener('afterprint', handleAfterPrint);
      
      setTimeout(() => {
        window.print();
      }, 300);

      return () => {
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

  const handleSyncPrices = async () => {
    if (!window.confirm('¿Deseas actualizar los precios unitarios de TODO el presupuesto usando la Base Maestra? Los rendimientos y cantidades se mantendrán intactos.')) return;
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

  const calculatePU = (item) => calculateItemPU(item, budget);

  const calculateBudgetTotal = () => calculateBudgetTotals(budget);

  const handleQuantityChange = (itemId, newQuantity) => {
    // Optimistic UI update
    setBudget(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, quantity: parseFloat(newQuantity) || 0 } : i)
    }));
  };

  const saveQuantity = async (itemId, newQuantity) => {
    try {
      await budgetService.updateItem(budget.id, itemId, { quantity: parseFloat(newQuantity) || 0 });
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
    <div className="absolute inset-0 p-4 md:p-6 flex flex-col overflow-hidden w-full max-w-7xl mx-auto no-print">
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
            setBudget(prev => ({ ...prev, ...newSettings }));
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
          budgetName={budget.name}
        />
      )}

      {/* APU PRINT LAYOUT */}
      {apuPrintOptions && apuToPrint && (
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
          options={{ ...apuPrintOptions, companyName: budget.company_name || budget.name }}
        />
      )}

      {/* WORKSHEET TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0 relative">
          <DragDropContext onDragEnd={handleDragEnd}>
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-30 shadow-md ring-1 ring-slate-200 bg-white">
                {/* PAGE HEADER INSIDE TABLE HEADER */}
                <tr>
                  <th colSpan="8" className="p-0 border-b border-slate-200 bg-white">
                    <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => navigate('/budgets')}
                          className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                        >
                          <ArrowLeft size={20} className="text-slate-600" />
                        </button>
                        <div>
                          <h1 className="text-2xl font-bold text-slate-800 leading-tight">{budget.name}</h1>
                        </div>
                      </div>
                      <div className="hidden md:flex items-center">
                        <span className="text-sm text-green-700 font-bold bg-green-50 px-4 py-1.5 rounded-xl border border-green-200 shadow-sm">
                          Total Partidas: {budget.items.filter(item => !item.is_chapter).length}
                        </span>
                      </div>
                      <div className="flex gap-3">
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
                              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm text-sm"
                            >
                              <Settings size={16} /> Configuración Global
                            </button>
                            <button 
                              onClick={() => setShowPrintModal(true)}
                              className="flex items-center gap-2 px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl hover:bg-amber-50 transition-colors font-medium shadow-sm text-sm"
                            >
                              <Printer size={16} /> Imprimir
                            </button>
                          </div>,
                          headerPortalTarget
                        )}
                        <button  
                          onClick={() => { setChapterName(""); setShowChapterModal(true); }}
                          className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl font-medium shadow-sm transition-all text-sm"
                        >
                          <FolderPlus size={16} /> Agregar Capítulo
                        </button>
                        <button  
                          onClick={handleOpenSearchModal}
                          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all active:scale-95 text-sm"
                        >
                          <Plus size={16} /> Agregar Partida
                        </button>
                      </div>
                    </div>
                  </th>
                </tr>
                {/* COLUMN HEADERS */}
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold shadow-sm">
                  <th className="p-4 w-16 text-center bg-slate-50 border-b border-slate-200">#</th>
                  <th className="p-4 w-32 bg-slate-50 border-b border-slate-200">Código</th>
                  <th className="p-4 bg-slate-50 border-b border-slate-200">Descripción</th>
                  <th className="p-4 w-20 text-center bg-slate-50 border-b border-slate-200">Unidad</th>
                  <th className="p-4 w-32 text-right bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-end gap-1.5 group/th relative cursor-help">
                      <span>Cantidad</span>
                      <Calculator size={13} className="text-amber-600 hover:text-amber-700 transition-colors shrink-0" />
                      
                      {/* Tooltip flotante */}
                      <div className="absolute bottom-full right-0 mb-2 hidden group-hover/th:flex flex-col w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl z-50 pointer-events-none normal-case font-normal leading-relaxed border border-slate-700 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-1.5 font-bold text-amber-300 pb-1.5 border-b border-slate-700">
                          <Calculator size={13} />
                          <span>Fórmulas directas (Tipo ETABS)</span>
                        </div>
                        <p className="mt-1.5 text-slate-300 text-[11px]">
                          Puedes escribir operaciones matemáticas básicas directamente:
                        </p>
                        <div className="mt-1.5 font-mono text-[10px] text-amber-200 bg-slate-800/90 p-2 rounded-lg space-y-1">
                          <div>• 12.5 * 3</div>
                          <div>• (4.5 + 3.2) * 2.60</div>
                          <div>• 100 / 4 + 15</div>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1.5 italic">Pulsa Enter o sal del campo para resolver automáticamente.</span>
                      </div>
                    </div>
                  </th>
                  <th className="p-4 w-32 text-right bg-slate-50 border-b border-slate-200">P.U.</th>
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
                                    <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                      <MathQuantityInput 
                                        className="w-28 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors font-mono text-sm font-semibold text-slate-800"
                                        value={item.quantity}
                                        onChange={val => handleQuantityChange(item.id, val)}
                                        onSave={val => saveQuantity(item.id, val)}
                                      />
                                    </td>
                                    <td className="p-4 text-right text-sm font-medium text-slate-700">
                                      {calculatePU(item).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-right text-sm font-bold text-slate-900">
                                      {(calculatePU(item) * item.quantity).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        
        {/* FOOTER: NOTAS & TOTAL */}
        {budget.items?.length > 0 && (
          <div className="mt-4 flex-none flex flex-col md:flex-row items-stretch md:items-start justify-between gap-6">
            {/* ÁREA DE NOTAS */}
            <div className="flex-1 max-w-2xl bg-white p-3 rounded-2xl border border-slate-300 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText size={14} className="text-slate-400" />
                  Notas del Presupuesto
                </span>
                <span className="text-[11px] text-slate-400">
                  (Se incluirá en la impresión solo si contiene texto)
                </span>
              </div>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Escribe notas, observaciones, términos de validez o condiciones de pago..."
                rows={2}
                className="w-full bg-transparent border-0 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* TABLA DE TOTALES */}
            <div className="bg-slate-50 px-4 py-2 rounded-2xl border-2 border-slate-300 shadow-sm min-w-[300px] shrink-0">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium text-sm leading-none">SUBTOTAL</span>
                <span className="text-lg font-semibold text-slate-700 leading-none">
                  {subtotalPresupuesto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium text-sm leading-none">I.V.A. ({budget.iva_percent ?? 16}%)</span>
                <span className="text-lg font-semibold text-slate-700 leading-none">
                  {ivaAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium text-sm leading-none">TOTAL ({budget.currency})</span>
                <span className="text-lg font-semibold text-slate-700 leading-none">
                  {totalGeneral.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* SEARCH MODAL */}
      {showSearchModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-20">
          <div className="w-full max-w-4xl bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col h-[80vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
              <div className="flex items-center gap-4">
                <h2 className="m-0 text-xl font-bold text-amber-900 flex items-center gap-2">
                  <Search className="text-sky-600" /> Buscar Partidas
                </h2>
                
                <div className="flex gap-2">
                  {/* Dropdown Base de Datos */}
                  <div 
                    className="relative"
                    onMouseEnter={() => setModalDbDropdownOpen(true)}
                    onMouseLeave={() => setModalDbDropdownOpen(false)}
                  >
                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm text-sm"
                    >
                      <Database size={16} />
                      {activeDatabase.name || 'Base de Datos'}
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
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm text-sm"
                    >
                      <FileText size={16} />
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
                className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>
            
            {!activeDatabase.is_budget && (
              <div className="px-6 py-4 border-b border-amber-600/15 bg-white/40">
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
                  <p className="mt-3 text-xs text-slate-500 font-medium">
                    <span className="font-bold text-slate-700">{new Intl.NumberFormat('es-VE').format(totalSearchResults)}</span>{' '}
                    {(searchQuery || searchCovenin) ? 'coincidencias' : 'Total Partidas'}
                  </p>
                )}
              </div>
            )}

            <div className="overflow-y-auto p-4 flex-1 bg-white/20">
              {searchResults.length === 0 && !searching ? (
                <div className="text-center py-12 text-amber-700/70 text-sm font-medium">
                  No se encontraron partidas.
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map(item => (
                    <div 
                      key={item.CodPar}
                      className="bg-white/80 border border-amber-600/10 rounded-xl p-4 flex gap-4 hover:border-sky-300 hover:shadow-md transition-all items-center"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-mono text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            {item.CovPar || item.CodPar}
                          </span>
                          <span className="text-[11px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                            UND: {item.UniPar}
                          </span>
                        </div>
                        <p className="text-[13px] text-amber-950 line-clamp-2 leading-relaxed m-0">
                          {item.Descri}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleAddItem(item)}
                        className="shrink-0 flex items-center gap-1.5 bg-transparent border border-sky-200 hover:border-sky-500 hover:bg-sky-50 text-sky-700 px-4 py-1.5 rounded-lg font-semibold transition-colors text-xs"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[550px] bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
                className="px-4 py-2 border border-sky-200 rounded-xl text-sm text-sky-700 bg-sky-50 outline-none transition-all focus:border-sky-600 focus:bg-sky-100 focus:ring-4 focus:ring-sky-700/10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddChapter();
                }}
              />
              <div className="flex justify-end gap-4 mt-2">
                <button 
                  onClick={() => { setShowChapterModal(false); setChapterName(""); }}
                  className="bg-transparent border-none text-amber-700 text-sm font-semibold px-6 py-2 cursor-pointer rounded-xl hover:bg-white/30 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleAddChapter}
                  className="bg-sky-600 text-white border-none text-sm font-semibold px-6 py-2 rounded-xl cursor-pointer shadow-[0_4px_6px_rgba(2,132,199,0.2)] transition-all hover:bg-sky-700 hover:-translate-y-[1px]"
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-red-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Eliminar {itemToDelete.is_chapter ? 'capítulo' : 'partida'}</h3>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">
              ¿Estás seguro de que deseas eliminar este elemento del presupuesto? Esta acción actualizará los totales y no se puede deshacer.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDelete}
                className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors w-full shadow-lg shadow-red-500/30"
              >
                Sí, eliminar
              </button>
              <button 
                onClick={() => setItemToDelete(null)}
                className="px-5 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors w-full"
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
