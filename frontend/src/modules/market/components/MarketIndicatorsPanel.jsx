import React, { useState, useEffect } from 'react';
import { marketService } from '../services/marketService';
import { Layers, Activity, TrendingUp, Save, Search, RefreshCw, Edit3, X } from 'lucide-react';

export default function MarketIndicatorsPanel() {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editPrices, setEditPrices] = useState({});

  // Leader Modal State
  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [familyMaterials, setFamilyMaterials] = useState([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [savingNewLeader, setSavingNewLeader] = useState(false);

  useEffect(() => {
    fetchIndicators();
  }, []);

  const fetchIndicators = async () => {
    setLoading(true);
    try {
      const res = await marketService.getIndicators();
      setIndicators(res.items || []);
      
      // Initialize edit state
      const initialPrices = {};
      (res.items || []).forEach(item => {
        initialPrices[item.id] = item.price;
      });
      setEditPrices(initialPrices);
    } catch (error) {
      console.error("Error fetching indicators:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (id, value) => {
    setEditPrices(prev => ({ ...prev, [id]: value }));
  };

  const handleUpdatePrice = async (indicator) => {
    const newPrice = parseFloat(editPrices[indicator.id]);
    if (isNaN(newPrice) || newPrice <= 0) return;
    
    setUpdating(indicator.id);
    try {
      await marketService.updateLeaderPrice(indicator.id, newPrice);
      // Refresh to show it applied correctly
      await fetchIndicators();
    } catch (error) {
      console.error("Error updating price:", error);
      alert("Hubo un error al actualizar el precio en cascada.");
    } finally {
      setUpdating(null);
    }
  };

  const openLeaderModal = async (indicator) => {
    setSelectedFamily(indicator);
    setShowLeaderModal(true);
    setLoadingFamily(true);
    try {
      const res = await marketService.getFamilyMaterials(indicator.family_id);
      setFamilyMaterials(res.items || []);
    } catch (error) {
      console.error("Error fetching family materials:", error);
    } finally {
      setLoadingFamily(false);
    }
  };

  const handleChangeLeader = async (newLeaderId) => {
    setSavingNewLeader(true);
    try {
      await marketService.changeFamilyLeader(selectedFamily.family_id, newLeaderId);
      setShowLeaderModal(false);
      await fetchIndicators();
    } catch (error) {
      console.error("Error changing leader:", error);
      alert(error.message || "Error al cambiar de líder");
    } finally {
      setSavingNewLeader(false);
    }
  };

  const filtered = indicators.filter(ind => 
    ind.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ind.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            Insumos Líderes
          </h2>
          <p className="text-slate-500 mt-1 max-w-2xl">
            Estos son los materiales principales que arrastran el precio de sus familias.
            Al actualizar un precio aquí, toda su familia se recalcula por dispersión.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar insumo líder..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64 shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchIndicators}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            title="Recargar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && indicators.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-slate-500">Cargando indicadores de mercado...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Layers className="w-12 h-12 text-slate-300 mb-3" />
            <p>No se encontraron insumos líderes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-4 px-6 w-1/4">Familia / Referencia</th>
                  <th className="py-4 px-6 w-1/3">Descripción del Líder</th>
                  <th className="py-4 px-6">Unidad</th>
                  <th className="py-4 px-6">Impacto (Familia)</th>
                  <th className="py-4 px-6">Precio Actual ($)</th>
                  <th className="py-4 px-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(indicator => (
                  <tr key={indicator.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
                        {indicator.family_name}
                      </div>
                      <div className="text-slate-500 font-mono text-xs flex items-center gap-2">
                        {indicator.id}
                        <button 
                          onClick={() => openLeaderModal(indicator)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
                          title="Cambiar insumo líder para esta familia"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800 line-clamp-2" title={indicator.description}>
                        {indicator.description}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium uppercase">
                        {indicator.unit}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100">
                          <TrendingUp className="w-3.5 h-3.5" />
                          {indicator.children_count} insumos
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editPrices[indicator.id] || ''}
                          onChange={(e) => handlePriceChange(indicator.id, e.target.value)}
                          className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 transition-shadow"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleUpdatePrice(indicator)}
                        disabled={updating === indicator.id || Number(editPrices[indicator.id]) === indicator.price}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                          ${updating === indicator.id 
                            ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed'
                            : Number(editPrices[indicator.id]) === indicator.price
                              ? 'bg-slate-100 text-slate-400 cursor-default'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-indigo-500/20 active:scale-95'
                          }`}
                      >
                        {updating === indicator.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>{updating === indicator.id ? 'Aplicando...' : 'Aplicar'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change Leader Modal */}
      {showLeaderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex flex-shrink-0 items-start justify-between bg-slate-50">
              <div className="pr-4">
                <h3 className="font-bold text-slate-800">Cambiar Insumo Líder</h3>
                <p className="text-sm text-slate-500 mt-0.5">Familia: {selectedFamily?.family_name}</p>
              </div>
              <button 
                onClick={() => setShowLeaderModal(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-auto flex-1">
              {loadingFamily ? (
                <div className="flex justify-center items-center h-32">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Insumo</th>
                      <th className="py-2 px-3 text-center">Usos (APUs)</th>
                      <th className="py-2 px-3">Precio</th>
                      <th className="py-2 px-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {familyMaterials.map(mat => (
                      <tr key={mat.id} className={mat.id === selectedFamily?.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-700">{mat.description}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{mat.id} • {mat.unit}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium">
                            {mat.usages}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          ${mat.price}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleChangeLeader(mat.id)}
                            disabled={savingNewLeader || mat.id === selectedFamily?.id || mat.price <= 0}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              mat.id === selectedFamily?.id
                                ? 'bg-indigo-100 text-indigo-700 cursor-default'
                                : mat.price <= 0 
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 shadow-sm'
                            }`}
                          >
                            {mat.id === selectedFamily?.id ? 'Líder Actual' : mat.price <= 0 ? 'Precio 0' : 'Elegir'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
              <button 
                onClick={() => setShowLeaderModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
