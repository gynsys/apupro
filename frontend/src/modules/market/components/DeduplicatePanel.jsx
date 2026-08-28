import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Search, AlertTriangle, CheckCircle, Layers, ChevronDown, ChevronRight, Loader } from 'lucide-react';
import { API_URL } from '../../../services/api';

const BADGE = ({ count, color }) => (
  <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] text-xs font-bold rounded-full px-1.5 ${color}`}>
    {count}
  </span>
);

const StatCard = ({ label, value, sub, color }) => (
  <div className={`rounded-xl p-4 border ${color}`}>
    <div className="text-2xl font-extrabold">{value?.toLocaleString('es-VE') ?? '—'}</div>
    <div className="text-sm font-semibold mt-0.5">{label}</div>
    {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
  </div>
);

const GroupRow = ({ grupo, tipo }) => {
  const [open, setOpen] = useState(false);
  const totalUsos = grupo.variantes.reduce((s, v) => s + (v.usos_en_apu || 0), 0);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        {open ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
        <span className="flex-1 font-medium text-slate-800 text-sm truncate">
          {grupo.variantes[0]?.descripcion || grupo.clave_normalizada || 'Sin descripción'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <BADGE count={`${grupo.total_en_grupo} copias`} color="bg-orange-100 text-orange-700" />
          {totalUsos > 0 && (
            <BADGE count={`${totalUsos} APUs`} color="bg-blue-100 text-blue-700" />
          )}
          <span className="text-xs text-red-600 font-semibold">
            -{grupo.eliminables} eliminable{grupo.eliminables !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2 w-1/2">Descripción en BD</th>
                <th className="px-4 py-2 text-center">Unidad</th>
                <th className="px-4 py-2 text-right">Precio</th>
                <th className="px-4 py-2 text-center">Usos en APUs</th>
                {tipo === 'exact' && <th className="px-4 py-2 text-center">Estado</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grupo.variantes.map((v, i) => (
                <tr key={v.codigo} className={i === 0 ? 'bg-emerald-50' : ''}>
                  <td className="px-4 py-2.5 font-mono text-blue-700 font-bold">{v.codigo}</td>
                  <td className="px-4 py-2.5 text-slate-700">{v.descripcion}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{v.unidad || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    {v.precio > 0 ? `$${v.precio.toFixed(2)}` : <span className="text-slate-300">Sin precio</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {v.usos_en_apu > 0
                      ? <span className="font-bold text-blue-600">{v.usos_en_apu}</span>
                      : <span className="text-slate-300">0</span>}
                  </td>
                  {tipo === 'exact' && (
                    <td className="px-4 py-2.5 text-center">
                      {i === 0
                        ? <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Candidato ganador</span>
                        : <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Duplicado</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
            <AlertTriangle size={12} className="inline mr-1" />
            <strong>Solo visualización.</strong> La fusión estará disponible en la próxima fase después de tu revisión.
          </div>
        </div>
      )}
    </div>
  );
};

export default function DeduplicatePanel() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [exactGroups, setExactGroups] = useState([]);
  const [loadingExact, setLoadingExact] = useState(false);
  const [exactLoaded, setExactLoaded] = useState(false);

  const [similarGroups, setSimilarGroups] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarLoaded, setSimilarLoaded] = useState(false);

  const [activeView, setActiveView] = useState('stats'); // 'stats' | 'exact' | 'similar'

  const token = () => localStorage.getItem('arko_admin_token');

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_URL}/dedup/duplicates/stats`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error('Error al obtener estadísticas');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      toast.error(err.message || 'Error de red');
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchExact = async () => {
    setLoadingExact(true);
    try {
      const res = await fetch(`${API_URL}/dedup/duplicates/exact?limit=300`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error('Error al obtener duplicados exactos');
      const data = await res.json();
      setExactGroups(data.grupos || []);
      setExactLoaded(true);
      toast.success(`${data.total_grupos} grupos de duplicados exactos encontrados`);
    } catch (err) {
      toast.error(err.message || 'Error de red');
    } finally {
      setLoadingExact(false);
    }
  };

  const fetchSimilar = async () => {
    setLoadingSimilar(true);
    toast.loading('Analizando similitudes (puede tomar 10-30 segundos)...', { id: 'similar' });
    try {
      const res = await fetch(`${API_URL}/dedup/duplicates/similar?threshold=0.85&limit=150`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error('Error al obtener duplicados similares');
      const data = await res.json();
      setSimilarGroups(data.grupos || []);
      setSimilarLoaded(true);
      toast.success(`${data.total_grupos} grupos de duplicados similares encontrados`, { id: 'similar' });
    } catch (err) {
      toast.error(err.message || 'Error de red', { id: 'similar' });
    } finally {
      setLoadingSimilar(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-5 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Diagnóstico de Materiales Duplicados</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Solo lectura — ningún dato se modifica. Revisa los resultados antes de proceder a la fusión.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loadingStats}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {loadingStats ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
          Calcular Diagnóstico
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total en BD"
            value={stats.total_materials}
            sub="Registros actuales"
            color="bg-slate-50 border-slate-200 text-slate-800"
          />
          <StatCard
            label="Únicos Reales Estimados"
            value={stats.estimated_unique_real}
            sub="Materiales sin duplicado"
            color="bg-emerald-50 border-emerald-200 text-emerald-800"
          />
          <StatCard
            label="Grupos con Duplicados Exactos"
            value={stats.exact_duplicate_groups}
            sub={`${stats.materials_in_exact_groups} materiales involucrados`}
            color="bg-orange-50 border-orange-200 text-orange-800"
          />
          <StatCard
            label="Eliminables (mínimo)"
            value={stats.estimated_eliminable}
            sub="Reducción estimada de la BD"
            color="bg-red-50 border-red-200 text-red-800"
          />
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {['exact', 'similar'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveView(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeView === tab ? 'text-blue-700 border-blue-600 bg-blue-50/60' : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {tab === 'exact'
              ? `Duplicados Exactos${exactLoaded ? ` (${exactGroups.length} grupos)` : ''}`
              : `Duplicados Similares${similarLoaded ? ` (${similarGroups.length} grupos)` : ''}`}
          </button>
        ))}
      </div>

      {/* Exact Duplicates Panel */}
      {activeView === 'exact' && (
        <div className="flex flex-col gap-3 flex-1">
          {!exactLoaded ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-12">
              <Layers size={48} className="text-slate-200" />
              <p className="text-slate-500 text-sm">
                Detecta materiales con <strong>descripción idéntica</strong> (normalizada) en la BD.
              </p>
              <button
                onClick={fetchExact}
                disabled={loadingExact}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {loadingExact ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                Buscar Duplicados Exactos
              </button>
            </div>
          ) : exactGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12">
              <CheckCircle size={48} className="text-emerald-300" />
              <p className="text-slate-500">¡No se encontraron duplicados exactos!</p>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  <strong className="text-slate-800">{exactGroups.length}</strong> grupos · 
                  <strong className="text-red-600 ml-1">{exactGroups.reduce((s, g) => s + g.eliminables, 0)}</strong> registros eliminables
                </p>
                <button onClick={fetchExact} disabled={loadingExact} className="text-xs text-slate-400 hover:text-slate-600">
                  ↻ Refrescar
                </button>
              </div>
              {exactGroups.map(g => (
                <GroupRow key={g.grupo_id} grupo={g} tipo="exact" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Similar Duplicates Panel */}
      {activeView === 'similar' && (
        <div className="flex flex-col gap-3 flex-1">
          {!similarLoaded ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 py-12">
              <Layers size={48} className="text-slate-200" />
              <p className="text-slate-500 text-sm max-w-md text-center">
                Detecta materiales con <strong>descripción similar</strong> (≥85% similitud).
                Este análisis toma entre 10 y 30 segundos.
              </p>
              <button
                onClick={fetchSimilar}
                disabled={loadingSimilar}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {loadingSimilar ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                Analizar Similitudes
              </button>
            </div>
          ) : similarGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12">
              <CheckCircle size={48} className="text-emerald-300" />
              <p className="text-slate-500">¡No se encontraron duplicados similares!</p>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  <strong className="text-slate-800">{similarGroups.length}</strong> grupos similares ·
                  <strong className="text-red-600 ml-1">{similarGroups.reduce((s, g) => s + g.eliminables, 0)}</strong> registros potencialmente fusionables
                </p>
                <button onClick={fetchSimilar} disabled={loadingSimilar} className="text-xs text-slate-400 hover:text-slate-600">
                  ↻ Refrescar
                </button>
              </div>
              {similarGroups.map(g => (
                <GroupRow key={g.grupo_id} grupo={g} tipo="similar" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
