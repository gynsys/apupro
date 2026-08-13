import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiLayers, FiArrowRight, FiBox, FiTool, FiUsers, FiDatabase } from 'react-icons/fi';
import toast from 'react-hot-toast';
import cost360Service from '../services/cost360Service';
import { cost360DatabaseService } from '../../../services/cost360DatabaseService';
import { SiteConfigContext } from '../../../App';
import CatalogResourceTab from '../components/CatalogResourceTab';
import Cost360SearchBar from '../components/Cost360SearchBar';
import { useCost360Search } from '../hooks/useCost360Search';

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

const Cost360Dashboard = () => {
  const [activeTab, setActiveTab] = useState('partidas');
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState('master');
  
  const navigate = useNavigate();
  const { config } = useContext(SiteConfigContext);

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
    databaseId: selectedDatabase,
    limit: 1000,
    autoSearch: true
  });

  useEffect(() => {
    const loadDatabases = async () => {
      try {
        const dbs = await cost360DatabaseService.getAll();
        const loadedDbs = dbs.databases || [];
        if (!loadedDbs.find(db => db.id === 'personalizada')) {
          loadedDbs.push({ id: 'personalizada', name: 'Base Personalizada', is_master: false });
        }
        setDatabases(loadedDbs);
      } catch (error) {
        console.error('Error al cargar bases de datos:', error);
      }
    };
    loadDatabases();
  }, []);

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
          <div className="pb-2">
            <select
              value={selectedDatabase}
              onChange={(e) => setSelectedDatabase(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm transition-all w-64 appearance-none"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")',
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem',
              }}
            >
              <option value="master">Base Maestra (Defecto)</option>
              {databases.filter(db => db.id !== 'master' && db.is_master !== true).map(db => (
                <option key={db.id} value={db.id}>{db.name}</option>
              ))}
            </select>
          </div>
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
                {search ? 'coincidencias' : 'Total Partidas'}
              </p>
            )}
          </div>

          {/* ── ZONE 5: Results list ──────────────────────── */}
          <div className="rounded-2xl overflow-y-auto flex-1 min-h-0 flex flex-col" style={glassStrong}>
            <div className="flex-1">
            {items.length > 0 ? (
              <ul className="divide-y" style={{ borderColor: 'rgba(148,163,255,0.15)' }}>
                {items.map((item) => (
                  <li
                    key={item.CodPar}
                    onClick={() => navigate(`/cost360/apu/${item.CodPar}`)}
                    className="group cursor-pointer transition-all duration-200 border-l-4 border-transparent hover:border-blue-600 hover:bg-blue-50/90 hover:shadow-md hover:translate-x-1"
                  >
                    <div className="px-5 py-4 flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
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
                        <FiArrowRight
                          size={18}
                          className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200"
                        />
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
          key={`mat-${selectedDatabase}`}
          title="Materiales"
          resourceType="materials"
          selectedDatabase={selectedDatabase}
          config={{
            idKey: 'CodMat', descKey: 'Descri',
            editableFields: [{ key: 'CosMat', label: 'Precio Unitario ($)' }]
          }}
        />
      )}

      {activeTab === 'equipos' && (
        <CatalogResourceTab
          key={`eq-${selectedDatabase}`}
          title="Equipos"
          resourceType="equipments"
          selectedDatabase={selectedDatabase}
          config={{
            idKey: 'CodEqu', descKey: 'Descri',
            editableFields: [{ key: 'CosDia', label: 'Costo Diario ($)' }]
          }}
        />
      )}

      {activeTab === 'mano_obra' && (
        <CatalogResourceTab
          key={`mo-${selectedDatabase}`}
          title="Mano de Obra"
          resourceType="labors"
          selectedDatabase={selectedDatabase}
          config={{
            idKey: 'CodMan', descKey: 'Descri',
            editableFields: [
              { key: 'Jornal', label: 'Jornal ($)' },
              { key: 'Bono',   label: 'Bono ($)' }
            ]
          }}
        />
      )}

    </div>
  );
};

export default Cost360Dashboard;
