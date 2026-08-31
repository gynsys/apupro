import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLayers, FiEdit2, FiTrash2, FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';
import GlassCard from '../../../../components/shared/GlassCard';
import Cost360SearchBar from '../Cost360SearchBar';
import { useCost360Search } from '../../hooks/useCost360Search';
import { generatePartidasExcel } from '../../../../lib/exportUtils';
import cost360Service from '../../services/cost360Service';
import EditPartidaModal from '../modals/EditPartidaModal';

const PartidasTab = ({ onlyCoded }) => {
  const navigate = useNavigate();
  const [editingItem, setEditingItem] = useState(null);

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
    forceSearch: handleSearch,
  } = useCost360Search({
    databaseId: 'master',
    limit: 100,
    onlyCoded: onlyCoded,
    autoSearch: true,
  });

  const handleExportToCsv = async () => {
    if (totalItems === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const toastId = toast.loading('Obteniendo todas las partidas para exportar...');
    let exportItems = [];
    try {
      const response = await cost360Service.getMasterItems(10000);
      exportItems = response.items || [];
    } catch (err) {
      toast.error('Error al obtener los datos completos', { id: toastId });
      return;
    }
    toast.success('Datos obtenidos, generando Excel...', { id: toastId });
    generatePartidasExcel(exportItems);
    toast.success('Listado exportado correctamente a Excel con formato');
  };

  const handleDelete = async (item) => {
    if (window.confirm("¿Estas seguro de eliminar esta partida maestra? Esto es irreversible y afectara a todos.")) {
      try {
        await cost360Service.deleteMasterItem(item.CodPar);
        toast.success("Partida eliminada");
        handleSearch();
      } catch (err) {
        toast.error("Error al eliminar partida");
      }
    }
  };

  return (
    <>
      <GlassCard className="rounded-2xl p-4 flex flex-col gap-3">
        <Cost360SearchBar />

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
      </GlassCard>

      <GlassCard strength="strong" className="rounded-2xl overflow-y-auto flex-1 min-h-0 flex flex-col">
        <div className="flex-1">
          {items.length > 0 ? (
            <ul className="divide-y" style={{ borderColor: 'rgba(148,163,255,0.15)' }}>
              {items.map((item) => (
                <li
                  key={item.CodPar}
                  className="group transition-all duration-200 border-l-4 border-transparent hover:border-blue-600 hover:bg-blue-50/90 hover:shadow-md hover:translate-x-1"
                >
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div
                      className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer"
                      onClick={() => navigate(`/cost360/apu/${item.CodPar}`)}
                    >
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
                          onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
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
              Cargar Mas Partidas
            </button>
          </div>
        )}
      </GlassCard>

      {editingItem && (
        <EditPartidaModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdated={handleSearch}
        />
      )}
    </>
  );
};

export default PartidasTab;
