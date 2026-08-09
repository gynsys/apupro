import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, Settings, Plus, Search, Layers, FileText, 
  DollarSign, Hash, Percent, Loader, X, Trash2, ArrowUp, ArrowDown, FolderPlus, RefreshCw, ChevronDown, Database
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { budgetService } from '../../services/budgetService';
import { API_URL } from '../../services/api';
import { useDatabaseContext } from '../../contexts/DatabaseContext';
import BudgetSettingsModal from '../../components/modals/BudgetSettingsModal';
import Cost360SearchBar from '../../modules/cost360/components/Cost360SearchBar';

export default function BudgetWorksheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [headerDbDropdownOpen, setHeaderDbDropdownOpen] = useState(false);
  const { activeDatabase, setActiveDatabase, databases } = useDatabaseContext();
  
  // Settings Panel
  const [showSettings, setShowSettings] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCovenin, setSearchCovenin] = useState('');
  const [searchChapter, setSearchChapter] = useState('');
  const [searchDesc, setSearchDesc] = useState(true);
  const [searchInsumos, setSearchInsumos] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [totalSearchResults, setTotalSearchResults] = useState(0);
  const [searching, setSearching] = useState(false);

  // Row selection & Reordering
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Custom modals state
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [chapterName, setChapterName] = useState("");
  const [itemToDelete, setItemToDelete] = useState(null);

  const [editingChapterId, setEditingChapterId] = useState(null);
  const [editingChapterName, setEditingChapterName] = useState("");

  const location = useLocation();

  useEffect(() => {
    loadBudget();
    if (new URLSearchParams(location.search).get('settings') === 'true') {
      setShowSettings(true);
    }
  }, [id, location.search]);

  const loadBudget = async () => {
    try {
      setLoading(true);
      const data = await budgetService.getById(id);
      setBudget(data);
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

  const searchDatabase = async (e) => {
    if (e) e.preventDefault();
    try {
      setSearching(true);
      const params = new URLSearchParams({
        limit: '30',
        database_id: activeDatabase.id,
        search_desc: searchDesc,
        search_insumos: searchInsumos
      });
      
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (searchCovenin.trim()) params.append('covenin', searchCovenin.trim());
      if (searchChapter.trim()) params.append('chapter', searchChapter.trim());
      
      const url = `${API_URL}/cost360/items?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(data.items || []);
      setTotalSearchResults(data.total || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleOpenSearchModal = () => {
    setShowSearchModal(true);
    if (searchResults.length === 0) {
      searchDatabase();
    }
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
        const apuRes = await fetch(`${API_URL}/cost360/items/${item.CodPar}/apu?database_id=${activeDatabase.id}`);
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
        cod_par: item.CodPar,
        cov_par: item.CovPar || '',
        description: item.Descri,
        unit: item.UniPar || 'UND',
        quantity: 1.0,
        performance: item.RenPar || 1.0,
        order: targetOrder,
        is_chapter: false,
        materials,
        equipments,
        labors
      });
      setShowSearchModal(false);
      setSearchQuery('');
      setSearchResults([]);
      loadBudget();
      toast.success(
        activeDatabase.is_master
          ? 'Partida agregada al presupuesto'
          : `Partida agregada con precios de “${activeDatabase.name}”`
      );
    } catch (error) {
      toast.error('Error agregando partida');
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

  const handleMove = async (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === budget.items.length - 1) return;
    
    const newItems = [...budget.items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap in array
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    
    // Update state immediately for UX
    setBudget(prev => ({ ...prev, items: newItems }));
    
    try {
      // Send the new ordered IDs to backend
      const itemIds = newItems.map(i => i.id);
      await budgetService.reorderItems(id, itemIds);
    } catch (error) {
      toast.error('Error reordenando las partidas');
      loadBudget(); // Revert on failure
    }
  };

  const calculatePU = (item) => {
    const exRate = budget?.currency === 'BS' ? (budget?.exchange_rate || 1.0) : 1.0;

    // 1. Materiales
    const matCost = (item.materials || []).reduce((acc, curr) => {
      const q = parseFloat(curr.cantidad || 0);
      const w = parseFloat(curr.desperdicio || 0);
      const p = parseFloat(curr.precio_unitario || 0) * exRate;
      const quantityWithWaste = q * (1 + w / 100);
      return acc + (quantityWithWaste * p);
    }, 0);
    
    // 2. Equipos
    const eqTotalDay = (item.equipments || []).reduce((acc, curr) => {
      const q = parseFloat(curr.cantidad || 0);
      const d = parseFloat(curr.depreciacion ?? 1.0);
      const p = parseFloat(curr.precio_unitario || 0) * exRate;
      return acc + (q * d * p);
    }, 0);
    const eqCost = eqTotalDay / (item.performance || 1);
    
    // 3. Mano de Obra
    const totJornal = (item.labors || []).reduce((acc, curr) => {
      const q = parseFloat(curr.cantidad || 0);
      const j = parseFloat(curr.jornal || 0) * exRate;
      return acc + (q * j);
    }, 0);
    const totBono = (item.labors || []).reduce((acc, curr) => {
      const q = parseFloat(curr.cantidad || 0);
      const b = parseFloat(curr.bono || 0) * exRate;
      return acc + (q * b);
    }, 0);
    
    const fcasPercent = budget?.fcas_percent ?? 417;
    const fcasMonto = totJornal * (fcasPercent / 100);
    const labTotalDay = totJornal + totBono + fcasMonto;
    const labCost = labTotalDay / (item.performance || 1);
    
    // Add Administrative and Profit overheads from budget config
    const subtotal = matCost + eqCost + labCost;
    const adminPercent = budget?.admin_percent ?? 15.0;
    const utilPercent = budget?.profit_percent ?? 10.0;
    
    const admin = subtotal * (adminPercent / 100);
    const subtotalB = subtotal + admin;
    const util = subtotalB * (utilPercent / 100);
    
    return subtotalB + util;
  };

  const calculateBudgetTotal = () => {
    const subtotalPresupuesto = budget?.items?.reduce((sum, item) => sum + (calculatePU(item) * item.quantity), 0) || 0;
    const ivaAmount = subtotalPresupuesto * ((budget?.iva_percent ?? 16.0) / 100);
    const totalGeneral = subtotalPresupuesto + ivaAmount;
    return { subtotalPresupuesto, ivaAmount, totalGeneral };
  };

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
    <div className="absolute inset-0 p-4 md:p-6 flex flex-col overflow-hidden w-full max-w-7xl mx-auto">
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

      {/* WORKSHEET TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0 relative">
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
                        <p className="text-sm text-slate-500 font-medium font-normal">Hoja de Presupuesto</p>
                      </div>
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
                <th className="p-4 w-20 text-center bg-slate-50 border-b border-slate-200">Und</th>
                <th className="p-4 w-28 text-right bg-slate-50 border-b border-slate-200">Cantidad</th>
                <th className="p-4 w-32 text-right bg-slate-50 border-b border-slate-200">Precio Unit.</th>
                <th className="p-4 w-32 text-right bg-slate-50 border-b border-slate-200">Total</th>
                <th className="p-4 w-32 text-center bg-slate-50 border-b border-slate-200">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                  return budget.items.map((item, idx) => {
                    const isSelected = selectedItemId === item.id;
                    
                    if (item.is_chapter) {
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                          className={`hover:bg-slate-100 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/50 ring-inset ring-2 ring-blue-500/50' : 'bg-slate-100/50'}`}
                        >
                          <td className="p-4 text-center font-bold text-slate-800"></td>
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
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); handleMove(idx, 'up'); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors" title="Subir">
                                <ArrowUp size={16} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleMove(idx, 'down'); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors" title="Bajar">
                                <ArrowDown size={16} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors" title="Eliminar">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    itemNumber++;
                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                        className={`hover:bg-blue-50/50 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50 ring-inset ring-2 ring-blue-400' : ''}`}
                      >
                        <td className="p-4 text-center text-slate-400 font-medium text-sm">{itemNumber}</td>
                        <td className="p-4 text-sm font-mono text-slate-600">{item.cov_par || item.cod_par}</td>
                      <td className="p-4 text-sm text-slate-800">
                        <div className="line-clamp-2 leading-relaxed" title={item.description}>
                          {item.description}
                        </div>
                      </td>
                      <td className="p-4 text-center text-sm font-medium text-slate-500">{item.unit}</td>
                      <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                        <input 
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={item.quantity}
                          onChange={e => handleQuantityChange(item.id, e.target.value)}
                          onBlur={e => saveQuantity(item.id, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                        />
                      </td>
                      <td className="p-4 text-right text-sm font-medium text-slate-700">
                        {calculatePU(item).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right text-sm font-bold text-slate-900">
                        {(calculatePU(item) * item.quantity).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleMove(idx, 'up'); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors" title="Subir">
                            <ArrowUp size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleMove(idx, 'down'); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors" title="Bajar">
                            <ArrowDown size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/budgets/${budget.id}/item/${item.id}`); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors" title="Editar APU">
                            <Settings size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors" title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()
              )}
            </tbody>
          </table>
        </div>
        </div>
        
        {/* FOOTER TOTAL */}
        {budget.items?.length > 0 && (
          <div className="mt-4 flex-none flex justify-end">
            <div className="bg-slate-50 px-4 py-2 rounded-2xl border-2 border-slate-300 shadow-sm min-w-[300px]">
              <div className="flex justify-between items-center pb-3">
                <span className="text-slate-500 font-medium text-sm leading-none">SUBTOTAL</span>
                <span className="text-lg font-semibold text-slate-700 leading-none mt-1">
                  {subtotalPresupuesto.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                </span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                <span className="text-slate-500 font-medium text-sm leading-none">I.V.A. ({budget.iva_percent ?? 16}%)</span>
                <span className="text-lg font-semibold text-slate-700 leading-none mt-1">
                  {ivaAmount.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5">
                <span className="text-slate-500 font-medium text-sm leading-none">TOTAL ({budget.currency})</span>
                <span className="text-lg font-semibold text-slate-700 leading-none mt-1">
                  {totalGeneral.toLocaleString('es-VE', {minimumFractionDigits: 2})}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* SEARCH MODAL */}
      {showSearchModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-20">
          <div className="w-full max-w-4xl bg-amber-100 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden font-sans flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-amber-600/15">
              <div className="flex items-center gap-4">
                <h2 className="m-0 text-xl font-bold text-amber-900 flex items-center gap-2">
                  <Search className="text-sky-600" /> Buscar Partidas
                </h2>
                {/* Database badge with active factors */}
                <div className="flex items-center gap-2 px-3 py-1 bg-sky-50 border border-sky-200 text-sky-700 rounded-lg text-xs font-medium shadow-sm">
                  <Database size={14} />
                  <span>{activeDatabase.name}</span>
                  {!activeDatabase.is_master && (
                    <span className="ml-1 text-[10px] text-emerald-700 bg-emerald-100/50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      {[activeDatabase.material_inflation ? `Mat +${activeDatabase.material_inflation}%` : null,
                        activeDatabase.labor_inflation ? `MO +${activeDatabase.labor_inflation}%` : null,
                        activeDatabase.equipment_inflation ? `Eq +${activeDatabase.equipment_inflation}%` : null
                      ].filter(Boolean).join(' • ') || 'Personalizada'}
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowSearchModal(false)}
                className="text-amber-700 hover:text-amber-900 bg-transparent transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="px-6 py-4 border-b border-amber-600/15 bg-white/40">
              <Cost360SearchBar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchCovenin={searchCovenin}
                setSearchCovenin={setSearchCovenin}
                searchChapter={searchChapter}
                setSearchChapter={setSearchChapter}
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
                  {(searchQuery || searchCovenin || searchChapter) ? 'coincidencias' : 'Total Partidas'}
                </p>
              )}
            </div>

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
            </div>
          </div>
        </div>,
        document.body
      )}
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
