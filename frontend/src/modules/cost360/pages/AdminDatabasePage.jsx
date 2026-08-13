import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiLayers, FiArrowRight, FiBox, FiTool, FiUsers, FiDatabase, FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import cost360Service from '../services/cost360Service';
import { cost360DatabaseService } from '../../../services/cost360DatabaseService';
import { SiteConfigContext } from '../../../App';
import CatalogResourceTab from '../components/CatalogResourceTab';
import Cost360SearchBar from '../components/Cost360SearchBar';

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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDesc, setSearchDesc] = useState(true);
  const [searchInsumos, setSearchInsumos] = useState(false);
  const [searchCovenin, setSearchCovenin] = useState('');
  const [chapter, setChapter] = useState('');
  const [skip, setSkip] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [onlyCoded, setOnlyCoded] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  
  const LIMIT = 100;
  const navigate = useNavigate();
  const { config } = useContext(SiteConfigContext);
  const searchTimeoutRef = useRef(null);

  const fetchPartidas = async (searchQuery = '', chapterQuery = '', currentSkip = 0, append = false, sDesc = searchDesc, sInsumos = searchInsumos, sCovenin = searchCovenin) => {
    try {
      setLoading(true);
      const response = await cost360Service.fetchItems(currentSkip, LIMIT, searchQuery, chapterQuery, 'master', sDesc, sInsumos, sCovenin, onlyCoded);
      if (append) {
        setItems(prev => [...prev, ...response.items]);
      } else {
        setItems(response.items);
      }
      setTotalItems(response.total);
      setHasMore(response.items.length === LIMIT && (currentSkip + LIMIT) < response.total);
    } catch (error) {
      toast.error('Error al cargar la base de datos de CostBase');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(() => {
      fetchPartidas(search, chapter, 0, false, searchDesc, searchInsumos, searchCovenin);
    }, 400);
  }, [chapter, onlyCoded, searchDesc, searchInsumos, searchCovenin]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setSkip(0);
    fetchPartidas(search, chapter, 0, false, searchDesc, searchInsumos, searchCovenin);
  };

  const handleLoadMore = () => {
    const newSkip = skip + LIMIT;
    setSkip(newSkip);
    fetchPartidas(search, chapter, newSkip, true, searchDesc, searchInsumos, searchCovenin);
  };

  const TABS = [
    { key: 'partidas',   label: 'Partidas (APU)', Icon: FiLayers },
    { key: 'materiales', label: 'Materiales',      Icon: FiBox   },
    { key: 'equipos',    label: 'Equipos',         Icon: FiTool  },
    { key: 'mano_obra',  label: 'Mano de Obra',    Icon: FiUsers },
  ];

  return (
    <div className="absolute inset-0 p-4 md:p-6 flex flex-col overflow-hidden gap-4">

      <div className="rounded-2xl overflow-hidden" style={glassStrong}>
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
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">Explora las Bases de Datos, Insumos, Materiales o Personal</h1>
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
            <div className="pb-2 flex items-center gap-2">
              <input 
                type="checkbox" 
                id="onlyCoded" 
                checked={onlyCoded} 
                onChange={(e) => setOnlyCoded(e.target.checked)} 
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="onlyCoded" className="text-sm font-medium text-slate-700">Solo Partidas Codificadas</label>
            </div>
          )}
        </div>
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
              searchChapter={chapter}
              setSearchChapter={setChapter}
              searchDesc={searchDesc}
              setSearchDesc={setSearchDesc}
              searchInsumos={searchInsumos}
              setSearchInsumos={setSearchInsumos}
              isSearching={loading}
              onSearch={handleSearch}
            />

            {totalItems > 0 && (
              <p className="mt-3 text-xs text-slate-500 font-medium">
                <span className="font-bold text-slate-700">{new Intl.NumberFormat('es-VE').format(totalItems)}</span>{' '}
                {(search || chapter) ? 'coincidencias' : 'Total Partidas'}
              </p>
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
        <CatalogResourceTab
          key={`mat-master`}
          title="Materiales"
          resourceType="materials"
          selectedDatabase="master"
          adminMode={true}
          config={{
            idKey: 'CodMat', descKey: 'Descri',
            editableFields: [{ key: 'CosMat', label: 'Precio Unitario ($)' }]
          }}
        />
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

