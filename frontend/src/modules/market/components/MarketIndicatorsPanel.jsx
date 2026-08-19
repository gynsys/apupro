import React, { useState, useEffect } from 'react';
import { marketService } from '../services/marketService';
import { Layers, Activity, TrendingUp, Save, Search, RefreshCw } from 'lucide-react';

export default function MarketIndicatorsPanel() {
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editPrices, setEditPrices] = useState({});

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
                  <th className="py-4 px-6">Referencia</th>
                  <th className="py-4 px-6 w-1/3">Descripción del Líder</th>
                  <th className="py-4 px-6">Impacto (Familia)</th>
                  <th className="py-4 px-6">Precio Actual ($)</th>
                  <th className="py-4 px-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(indicator => (
                  <tr key={indicator.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-6 text-slate-500 font-mono text-xs">
                      {indicator.id}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800 line-clamp-2" title={indicator.description}>
                        {indicator.description}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                          {indicator.unit}
                        </span>
                      </div>
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
    </div>
  );
}
