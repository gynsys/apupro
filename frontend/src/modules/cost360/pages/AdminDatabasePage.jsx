import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiLayers, FiArrowRight, FiBox, FiTool, FiUsers, FiDatabase, FiEdit2, FiTrash2, FiSave, FiX, FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';
import cost360Service from '../services/cost360Service';
import { cost360DatabaseService } from '../../../services/cost360DatabaseService';
import { SiteConfigContext } from '../../../App';
import { API_URL } from '../../../services/api';
import CatalogResourceTab from '../components/CatalogResourceTab';
import Cost360SearchBar from '../components/Cost360SearchBar';
import { useCost360Search } from '../hooks/useCost360Search';
import coveninTreeData from '../data/covenin_tree.json';

/* ── Shared glass style ─────────────────────────────────── */
const glass = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 4px 32px 0 rgba(80,100,200,0.08)',
};

const glassStrong = {
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '0 8px 40px 0 rgba(80,100,200,0.10)',
};

const AdminDatabasePage = () => {
  const [activeTab, setActiveTab] = useState('partidas');
  const [onlyCoded, setOnlyCoded] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [isCatMenuOpen, setIsCatMenuOpen] = useState(false);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPriceText, setBulkPriceText] = useState('');
  const catMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (catMenuRef.current && !catMenuRef.current.contains(event.target)) {
        setIsCatMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const navigate = useNavigate();
  const { config, setConfig } = useContext(SiteConfigContext);
  
  const {
    searchQuery: search,
    setSearchQuery: setSearch,
    searchCovenin, setSearchCovenin,
    searchDesc, setSearchDesc,
    searchInsumos, setSearchInsumos,
    results: items,
    totalResults: totalItems,
    isSearching: loading,
    hasMore,
    loadMore: handleLoadMore,
    forceSearch: handleSearch
  } = useCost360Search({
    databaseId: 'master',
    limit: 100,
    onlyCoded: onlyCoded,
    autoSearch: true
  });

  const handleToggleGlobalCoded = async (e) => {
    const isChecked = e.target.checked;
    const newConfig = { ...config, forceOnlyCodedMaster: isChecked };
    try {
      const token = localStorage.getItem('arko_admin_token');
      const response = await fetch(`${API_URL}/arko/admin/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newConfig)
      });
      if (response.ok) {
        const result = await response.json();
        const updatedConfig = result.config || newConfig;
        setConfig(updatedConfig);
        window.ARKO_SITE_CONFIG = updatedConfig;
        toast.success(isChecked ? "Filtro público ACTIVADO" : "Filtro público DESACTIVADO (El público verá basura)");
      } else {
        toast.error("Error al actualizar la configuración pública");
      }
    } catch(err) {
       toast.error("Error de red");
    }
  };

  const handleToggleCategory = async (code, isVisible) => {
    const hiddenCategories = config?.hiddenCategories || [];
    let newHidden = [...hiddenCategories];
    
    if (isVisible) {
      newHidden = newHidden.filter(c => c !== code);
    } else {
      if (!newHidden.includes(code)) {
        newHidden.push(code);
      }
    }
    
    const newConfig = { ...config, hiddenCategories: newHidden };
    try {
      const token = localStorage.getItem('arko_admin_token');
      const response = await fetch(`${API_URL}/arko/admin/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newConfig)
      });
      if (response.ok) {
        const result = await response.json();
        const updatedConfig = result.config || newConfig;
        setConfig(updatedConfig);
        window.ARKO_SITE_CONFIG = updatedConfig;
        toast.success(`Categoría ${code} ${isVisible ? 'ACTIVADA' : 'OCULTADA'} en el Buscador Público`);
      } else {
        toast.error("Error al actualizar la configuración de categorías");
      }
    } catch(err) {
       toast.error("Error de red");
    }
  };

  const handleExportToCsv = async () => {
    if (totalItems === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const toastId = toast.loading('Obteniendo todas las partidas para exportar...');
    let exportItems = [];
    try {
      const response = await cost360Service.fetchItems(0, 10000, search, '', 'master', searchDesc, searchInsumos, searchCovenin, onlyCoded);
      exportItems = response.items || [];
    } catch (err) {
      toast.error('Error al obtener los datos completos', { id: toastId });
      return;
    }
    toast.success('Datos obtenidos, generando Excel...', { id: toastId });

    const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
  </Style>
  <Style ss:ID="sDesc">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="9" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="sNormal">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="sNumber">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Partidas">
  <Table>
   <Column ss:Width="40"/>
   <Column ss:Width="100"/>
   <Column ss:Width="450"/>
   <Column ss:Width="60"/>
   <Row ss:Height="20">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">N°</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Código Covenin</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Descripción</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Unidad</Data></Cell>
   </Row>
   ${exportItems.map((item, index) => {
     const descri = (item.Descri || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
     const cov = (item.CovPar || item.CodPar || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     const uni = (item.UniPar || item.Unidad || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     return `<Row ss:Height="24">
    <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="sNormal"><Data ss:Type="String">${cov}</Data></Cell>
    <Cell ss:StyleID="sDesc"><Data ss:Type="String">${descri}</Data></Cell>
    <Cell ss:StyleID="sNormal"><Data ss:Type="String">${uni}</Data></Cell>
   </Row>`;
   }).join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob(['\uFEFF' + xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Listado_Partidas_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Listado exportado correctamente a Excel con formato');
  };

  const handleUpdateRAGBrain = async () => {
    const confirm = window.confirm("¿Estás seguro de que deseas actualizar el Cerebro RAG? Este proceso toma de 5 a 15 minutos en segundo plano y consumirá CPU del servidor.");
    if (!confirm) return;
    
    const toastId = toast.loading('Iniciando actualización del Cerebro IA...');
    try {
      const token = localStorage.getItem('arko_admin_token');
      const response = await fetch(`${API_URL}/cost360/rag/update-brain`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        toast.success('El Cerebro RAG se está actualizando en el servidor. Estará listo en unos minutos.', { id: toastId, duration: 8000 });
      } else {
        toast.error('Error al iniciar la actualización del Cerebro RAG', { id: toastId });
      }
    } catch(err) {
      toast.error('Error de conexión al servidor', { id: toastId });
    }
  };

  const TABS = [
    { key: 'partidas',   label: 'Partidas (APU)', Icon: FiLayers },
    { key: 'materiales', label: 'Materiales',      Icon: FiBox   },
    { key: 'equipos',    label: 'Equipos',         Icon: FiTool  },
    { key: 'mano_obra',  label: 'Mano de Obra',    Icon: FiUsers },
  ];

  return (
    <div className="absolute inset-0 p-4 md:p-6 flex flex-col overflow-hidden gap-4">

      <div className="rounded-2xl relative z-10" style={glassStrong}>
        <div
          className="px-6 py-5 flex items-center gap-4"
          style={{
            background: 'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, rgba(99,102,241,0.04) 100%)',
            borderBottom: '1px solid rgba(148,163,255,0.2)',
          }}
        >
          <div
            className="p-2.5 rounded-xl shadow-sm"
            style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff' }}
          >
            <FiDatabase size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">Explora las Bases de Datos, Insumos, Materiales o Personal</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleUpdateRAGBrain}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
            >
              <FiDatabase className="w-4 h-4" />
              Actualizar Cerebro RAG
            </button>
            <button 
              onClick={() => navigate('/cost360/market-admin')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Automatización IA
            </button>
          </div>
        </div>

        <div className="px-4 flex justify-between items-end pt-2 pb-0">
          <div className="flex gap-1">
            {TABS.map(({ key, label, Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all duration-200 btn-borde-azul-redondeado ${
                    active
                      ? 'text-blue-700 border-blue-600 bg-blue-50/60'
                      : 'text-slate-500 border-transparent'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
          {activeTab === 'partidas' && (
            <div className="pb-2 flex flex-col sm:flex-row items-end gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg" title="Afecta a todos los usuarios del sistema">
                <input 
                  type="checkbox" 
                  id="globalCoded" 
                  checked={config?.forceOnlyCodedMaster === true} 
                  onChange={handleToggleGlobalCoded} 
                  className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="globalCoded" className="text-sm font-bold text-indigo-900 cursor-pointer">
                  Filtro Público Global
                </label>
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <input 
                  type="checkbox" 
                  id="onlyCoded" 
                  checked={onlyCoded} 
                  onChange={(e) => setOnlyCoded(e.target.checked)} 
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="onlyCoded" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Filtro Local (Tu vista)
                </label>
              </div>
            </div>
          )}
        </div>
        {activeTab === 'partidas' && (
          <div className="px-6 pb-3 pt-2 bg-slate-50/50 border-t border-slate-200/50 flex flex-col gap-2 relative" ref={catMenuRef}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Gestión de Categorías:</span>
              <button 
                onClick={() => setIsCatMenuOpen(!isCatMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Configurar Visibilidad</span>
                <svg className={`w-4 h-4 transition-transform ${isCatMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
            
            {isCatMenuOpen && (
              <div className="absolute top-full left-6 mt-1 w-[400px] z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {coveninTreeData.map(cat => {
                  const isVisible = !(config?.hiddenCategories || []).includes(cat.code);
                  return (
                    <div key={cat.code} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${isVisible ? 'bg-slate-50 border-blue-200' : 'bg-white border-slate-100 opacity-60 hover:opacity-100'}`}>
                      <input 
                        type="checkbox" 
                        id={`cat_${cat.code}`}
                        checked={isVisible}
                        onChange={(e) => handleToggleCategory(cat.code, e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor={`cat_${cat.code}`} className="text-xs font-bold text-slate-700 cursor-pointer select-none leading-tight" title={cat.name}>
                        {cat.code} <span className="font-normal block truncate w-full max-w-[80px]" title={cat.name}>{cat.name}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="h-px" style={{ background: 'linear-gradient(90deg,rgba(148,163,255,0.4),transparent)' }} />
      </div>

      {activeTab === 'partidas' && (
        <>
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={glass}>
            <Cost360SearchBar
              searchQuery={search}
              setSearchQuery={setSearch}
              searchCovenin={searchCovenin}
              setSearchCovenin={setSearchCovenin}
              searchDesc={searchDesc}
              setSearchDesc={setSearchDesc}
              searchInsumos={searchInsumos}
              setSearchInsumos={setSearchInsumos}
              isSearching={loading}
              onSearch={handleSearch}
            />

            {totalItems > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500 font-medium">
                  <span className="font-bold text-slate-700">{new Intl.NumberFormat('es-VE').format(totalItems)}</span>{' '}
                  {search ? 'coincidencias' : 'Total Partidas'}
                </p>
                <button
                  onClick={handleExportToCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <FiDownload size={12} />
                  Exportar a Excel
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl overflow-y-auto flex-1 min-h-0 flex flex-col" style={glassStrong}>
            <div className="flex-1">
            {items.length > 0 ? (
              <ul className="divide-y" style={{ borderColor: 'rgba(148,163,255,0.15)' }}>
                {items.map((item) => (
                  <li
                    key={item.CodPar}
                    className="group transition-all duration-200 border-l-4 border-transparent hover:border-blue-600 hover:bg-blue-50/90 hover:shadow-md hover:translate-x-1"
                  >
                    <div className="px-5 py-4 flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/cost360/apu/${item.CodPar}`)}>
                        <div
                          className="mt-0.5 p-2 rounded-lg shrink-0 transition-colors duration-150"
                          style={{ background: 'rgba(219,234,254,0.8)', color: '#2563eb' }}
                        >
                          <FiLayers size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 font-mono mb-1">{item.CovPar || item.CodPar}</p>
                          <p className="text-sm text-slate-700 font-medium line-clamp-2 max-w-3xl group-hover:text-slate-900 transition-colors">{item.Descri}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(241,245,249,0.9)', color: '#475569', border: '1px solid rgba(148,163,184,0.3)' }}
                        >
                          {item.UniPar}
                        </span>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition"
                            title="Editar Partida"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm("¿Estás seguro de eliminar esta partida maestra? Esto es irreversible y afectará a todos.")) {
                                try {
                                  await cost360Service.deleteMasterItem(item.CodPar);
                                  toast.success("Partida eliminada");
                                  handleSearch();
                                } catch (err) {
                                  toast.error("Error al eliminar partida");
                                }
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded transition"
                            title="Eliminar Partida"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : !loading ? (
              <div className="py-20 text-center">
                <FiLayers size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400 text-sm">No se encontraron partidas con ese criterio.</p>
              </div>
            ) : null}

            {loading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            )}
          </div>

            {hasMore && !loading && items.length > 0 && (
              <div className="flex justify-center py-4 pb-8 shrink-0">
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-2.5 rounded-full text-sm font-semibold text-blue-700 transition-all duration-300 hover:shadow-[0_8px_20px_rgba(37,99,235,0.2)] hover:-translate-y-0.5 hover:bg-white"
                  style={{
                    background: 'rgba(255,255,255,0.8)',
                    border: '1.5px solid rgba(37,99,235,0.3)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  Cargar Más Partidas
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'materiales' && (
        <>
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={glass}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 font-medium">
                Actualización en masa de precios
              </p>
              <button
                onClick={() => setShowBulkPriceModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
              >
                <FiDownload size={16} />
                Actualizar Precios en Masa
              </button>
            </div>
          </div>

          <CatalogResourceTab
            key={`mat-master`}
            title="Materiales"
            resourceType="materials"
            selectedDatabase="master"
            adminMode={true}
            config={{
              idKey: 'CodMat', descKey: 'Descri',
              editableFields: [
                { key: 'Descri', label: 'Descripción', type: 'text' },
                { key: 'UniMat', label: 'Unidad', type: 'text' },
                { key: 'CosMat', label: 'Precio Unitario ($)' }
              ]
            }}
          />

          {showBulkPriceModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-slate-800">Actualizar Precios en Masa</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Pega los precios en formato: MAT1234: $1000 (uno por línea)
                  </p>
                </div>
                <div className="p-6 flex-1 flex flex-col gap-4">
                  <textarea
                    value={bulkPriceText}
                    onChange={(e) => setBulkPriceText(e.target.value)}
                    placeholder="MAT1347: $950 USD&#10;MAT1348: $1,350 USD&#10;MAT1349: $1,700 USD"
                    className="w-full h-64 p-4 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowBulkPriceModal(false);
                        setBulkPriceText('');
                      }}
                      className="px-4 py-2 text-slate-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        // Procesar el texto
                        const lines = bulkPriceText.split('\n').filter(line => line.trim());
                        const updates = [];
                        
                        for (const line of lines) {
                          // Match format: MATXXXX: $YYYY USD o MATXXXX: $YYYY
                          const match = line.match(/([A-Z]+\d+):\s*\$?([\d,\.]+)/);
                          if (match) {
                            const codigo = match[1];
                            const precio = parseFloat(match[2].replace(/,/g, ''));
                            if (!isNaN(precio)) {
                              updates.push({ codigo, precio });
                            }
                          }
                        }

                        if (updates.length === 0) {
                          toast.error('No se encontraron precios válidos para actualizar');
                          return;
                        }

                        try {
                          const token = localStorage.getItem('arko_admin_token');
                          
                          const response = await fetch(`${API_URL}/cost360/materials/bulk-update`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ updates })
                          });

                          if (response.ok) {
                            const result = await response.json();
                            
                            // Mostrar toast de éxito
                            toast.success(`${result.updated || updates.length} precios actualizados correctamente`, {
                              duration: 3000, // 3 segundos para que el usuario pueda verlo
                            position: 'top-center'
                            });
                            
                            // Cerrar modal y limpiar texto
                            setShowBulkPriceModal(false);
                            setBulkPriceText('');
                            
                            // Recargar solo los datos de materiales, no la página completa
                            setTimeout(() => {
                              handleSearch(); // Recargar búsqueda de materiales
                            }, 1000); // Retraso de 1 segundo para que el usuario vea el toast
                            
                          } else {
                            const errorText = await response.text();
                            toast.error(`Error al actualizar precios: ${response.status}`);
                          }
                        } catch (err) {
                          toast.error('Error de conexión al servidor');
                        }
                      }}
                      className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Actualizar {bulkPriceText.split('\n').filter(line => line.trim()).length} Precios
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'equipos' && (
        <CatalogResourceTab
          key={`eq-master`}
          title="Equipos"
          resourceType="equipments"
          selectedDatabase="master"
          adminMode={true}
          config={{
            idKey: 'CodEqu', descKey: 'Descri',
            editableFields: [{ key: 'CosDia', label: 'Costo Diario ($)' }]
          }}
        />
      )}

      {activeTab === 'mano_obra' && (
        <CatalogResourceTab
          key={`mo-master`}
          title="Mano de Obra"
          resourceType="labors"
          selectedDatabase="master"
          adminMode={true}
          config={{
            idKey: 'CodMan', descKey: 'Descri',
            editableFields: [
              { key: 'Jornal', label: 'Jornal Base ($)' },
              { key: 'Bono', label: 'Bono ($)' }
            ]
          }}
        />
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Editar Partida {editingItem.CodPar}</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Descripción</label>
                <textarea
                  value={editingItem.Descri}
                  onChange={(e) => setEditingItem({...editingItem, Descri: e.target.value})}
                  className="w-full text-sm font-medium text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Unidad</label>
                  <input
                    type="text"
                    value={editingItem.UniPar}
                    onChange={(e) => setEditingItem({...editingItem, UniPar: e.target.value})}
                    className="w-full text-sm font-medium text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Rendimiento</label>
                  <input
                    type="number"
                    value={editingItem.RenPar}
                    onChange={(e) => setEditingItem({...editingItem, RenPar: parseFloat(e.target.value) || 0})}
                    className="w-full text-sm font-medium text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await cost360Service.updateMasterItem(editingItem.CodPar, {
                      Descri: editingItem.Descri,
                      UniPar: editingItem.UniPar,
                      RenPar: editingItem.RenPar
                    });
                    toast.success("Partida actualizada");
                    setEditingItem(null);
                    handleSearch();
                  } catch (err) {
                    toast.error("Error al actualizar");
                  }
                }}
                className="px-6 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-all bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              >
                <FiSave size={16} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDatabasePage;

