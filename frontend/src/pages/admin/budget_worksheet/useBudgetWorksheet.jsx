import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { budgetService } from '../../../services/budgetService';
import { API_URL } from '../../../services/api';
import { useDatabaseContext } from '../../../contexts/DatabaseContext';
import { useCostbaseSearch as useCost360Search } from '../../../modules/costbase/hooks/useCostbaseSearch';
import { SiteConfigContext } from '../../../App';
import { calculateItemPU, calculateBudgetTotals } from '../../../utils/apuCalculations';

export function useBudgetWorksheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
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
  const [configTab, setConfigTab] = useState('general');
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
  const [showAIApuModal, setShowAIApuModal] = useState(false);
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
  const [availableBudgets, setAvailableBudgets] = useState([]);
  const [chapterName, setChapterName] = useState("");
  const [itemToDelete, setItemToDelete] = useState(null);
  const [exportingBudgetExcel, setExportingBudgetExcel] = useState(false);

  const [editingChapterId, setEditingChapterId] = useState(null);
  const [editingChapterName, setEditingChapterName] = useState("");

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

  useEffect(() => {
    loadBudget();
    if (new URLSearchParams(location.search).get('settings') === 'true') {
      setShowSettings(true);
    }
    if (new URLSearchParams(location.search).get('print') === 'true') {
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
      document.title = '';

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

  const handleInsertAIApu = async (generatedItem) => {
    if (!generatedItem) return;
    try {
      let targetOrder = 0;
      if (selectedItemId && budget?.items) {
        const selected = budget.items.find(i => i.id === selectedItemId);
        if (selected) targetOrder = selected.order + 1;
      }

      const materials = (generatedItem.materials || []).map((m, idx) => ({
        id: `m-${m.codigo || idx}`,
        codigo: m.codigo || '',
        descripcion: m.descripcion || '',
        unidad: m.unidad || 'und',
        cantidad: parseFloat(m.cantidad) || 0,
        desperdicio: parseFloat(m.desperdicio) || 0,
        precio_unitario: parseFloat(m.precio_unitario) || 0,
        origen: 'base_personalizada'
      }));

      const equipments = (generatedItem.equipments || []).map((e, idx) => ({
        id: `e-${e.codigo || idx}`,
        codigo: e.codigo || '',
        descripcion: e.descripcion || '',
        unidad: e.unidad || 'día',
        cantidad: parseFloat(e.cantidad) || 0,
        depreciacion: parseFloat(e.depreciacion ?? 1.0) || 1.0,
        precio_unitario: parseFloat(e.precio_unitario) || 0,
        origen: 'base_personalizada'
      }));

      const labors = (generatedItem.labors || []).map((l, idx) => ({
        id: `l-${l.codigo || idx}`,
        codigo: l.codigo || '',
        descripcion: l.descripcion || '',
        unidad: l.unidad || 'día',
        cantidad: parseFloat(l.cantidad) || 0,
        jornal: parseFloat(l.jornal) || 0,
        bono: parseFloat(l.bono) || 0,
        precio_unitario: parseFloat(l.precio_unitario) || (parseFloat(l.jornal || 0) + parseFloat(l.bono || 0)),
        origen: 'base_personalizada'
      }));

      await budgetService.addItem(id, {
        cod_par: generatedItem.cod_par || generatedItem.codigo || `IA-${Date.now().toString().slice(-4)}`,
        cov_par: generatedItem.cov_par || generatedItem.covenin || '',
        description: generatedItem.description || generatedItem.descripcion || '',
        unit: generatedItem.unit || generatedItem.unidad || 'UND',
        quantity: 1.0,
        performance: parseFloat(generatedItem.performance || generatedItem.rendimiento || 1.0) || 1.0,
        order: targetOrder,
        is_chapter: false,
        materials,
        equipments,
        labors
      });

      await loadBudget();
      toast.success('Partida generada con IA agregada exitosamente al presupuesto');
    } catch (err) {
      console.error('Error insertando APU de IA al presupuesto:', err);
      toast.error(err.message || 'Error al agregar partida al presupuesto');
      throw err;
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
    
    setBudget(prev => ({ ...prev, items: newItems }));
    
    try {
      const itemIds = newItems.map(i => i.id);
      await budgetService.reorderItems(id, itemIds);
    } catch (error) {
      toast.error('Error reordenando las partidas');
      loadBudget();
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

  return {
    id,
    budget,
    setBudget,
    loading,
    activeDatabase,
    setActiveDatabase,
    databases,
    showSettings,
    setShowSettings,
    showPrintModal,
    setShowPrintModal,
    printConfig,
    setPrintConfig,
    showSubscriptionModal,
    setShowSubscriptionModal,
    notesText,
    setNotesText,
    apuToPrint,
    setApuToPrint,
    showApuPrintModal,
    setShowApuPrintModal,
    apuPrintOptions,
    setApuPrintOptions,
    configTab,
    setConfigTab,
    settings,
    setSettings,
    syncing,
    showSearchModal,
    setShowSearchModal,
    showAIApuModal,
    setShowAIApuModal,
    searchQuery,
    setSearchQuery,
    searchCovenin,
    setSearchCovenin,
    searchDesc,
    setSearchDesc,
    searchInsumos,
    setSearchInsumos,
    searchResults,
    totalSearchResults,
    searching,
    searchDatabase,
    hasMoreSearchResults,
    loadMoreSearchResults,
    selectedItemId,
    setSelectedItemId,
    showChapterModal,
    setShowChapterModal,
    availableBudgets,
    chapterName,
    setChapterName,
    itemToDelete,
    setItemToDelete,
    exportingBudgetExcel,
    editingChapterId,
    setEditingChapterId,
    editingChapterName,
    setEditingChapterName,
    loadBudget,
    handleSyncPrices,
    handleOpenSearchModal,
    handleAddItem,
    handleInsertAIApu,
    handleAddChapter,
    handleDeleteItem,
    confirmDelete,
    handleSaveChapterEdit,
    handleDragEnd,
    handleMoveItem,
    calculatePU,
    calculateBudgetTotal,
    handleQuantityChange,
    saveQuantity,
    handleSaveNotes,
    handleExportBudgetToExcel,
  };
}
