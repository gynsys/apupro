import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Search, AlertTriangle, CheckCircle, Layers, ChevronDown, ChevronRight, Loader, Merge, Shield } from 'lucide-react';
import { apiFetch, apiPost, apiDelete } from '../../../lib/apiHelper';

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

// ── Fila de grupo individual ────────────────────────────────────────────────
const GroupRow = ({ grupo, tipo, isSelected, onToggleSelect, winnerCode, onChangeWinner }) => {
  const [open, setOpen] = useState(false);
  const totalUsos = grupo.variantes.reduce((s, v) => s + (v.usos_en_apu || 0), 0);
  const currentWinner = winnerCode || grupo.variantes[0]?.codigo;

  return (
    <div className={`border rounded-xl overflow-hidden mb-2 transition-colors ${isSelected ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200'}`}>
      <div className="flex items-center gap-2 px-3 py-3">
        {/* Checkbox de selección */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(grupo)}
          className="w-4 h-4 accent-blue-600 shrink-0 cursor-pointer"
        />

        {/* Expandir/colapsar */}
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          {open
            ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
            : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
          <span className="font-medium text-slate-800 text-sm truncate">
            {grupo.variantes[0]?.descripcion || 'Sin descripción'}
          </span>
        </button>

        {/* Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <BADGE count={`${grupo.total_en_grupo} copias`} color="bg-orange-100 text-orange-700" />
          {totalUsos > 0 && (
            <BADGE count={`${totalUsos} APUs`} color="bg-blue-100 text-blue-700" />
          )}
          <span className="text-xs text-red-600 font-semibold">
            -{grupo.eliminables} a eliminar
          </span>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 overflow-x-auto">
          {isSelected && (
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-xs text-blue-700">
              <Shield size={12} />
              <strong>Ganador (código que permanece):</strong>
              <select
                value={currentWinner}
                onChange={e => onChangeWinner(grupo.grupo_id, e.target.value)}
                className="ml-1 border border-blue-300 rounded px-2 py-0.5 text-xs bg-white text-blue-800 font-semibold"
              >
                {grupo.variantes.map(v => (
                  <option key={v.codigo} value={v.codigo}>
                    {v.codigo} — {v.descripcion.slice(0, 50)} {v.usos_en_apu > 0 ? `(${v.usos_en_apu} APUs)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2 w-1/2">Descripción en BD</th>
                <th className="px-4 py-2 text-center">Unidad</th>
                <th className="px-4 py-2 text-right">Precio</th>
                <th className="px-4 py-2 text-center">Usos APUs</th>
                <th className="px-4 py-2 text-center">Rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grupo.variantes.map((v) => {
                const esGanador = v.codigo === currentWinner;
                return (
                  <tr key={v.codigo} className={esGanador ? 'bg-emerald-50' : ''}>
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
                    <td className="px-4 py-2.5 text-center">
                      {esGanador
                        ? <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">✓ Permanece</span>
                        : <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">× Eliminar</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!isSelected && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
              ☑ Marca el checkbox para seleccionar este grupo para fusión
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Panel de lista de grupos ────────────────────────────────────────────────
const GroupList = ({ groups, tipo, loading, loaded, onLoad, loadLabel, selectedGroups, onToggleSelect, winnerCodes, onChangeWinner }) => {
  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 py-12">
        <Layers size={48} className="text-slate-200" />
        <p className="text-slate-500 text-sm max-w-md text-center">{loadLabel}</p>
        <button
          onClick={onLoad}
          disabled={loading}
          className={`flex items-center gap-2 ${tipo === 'exact' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-5 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50`}
        >
          {loading ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
          {tipo === 'exact' ? 'Buscar Duplicados Exactos' : 'Analizar Similitudes'}
        </button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12">
        <CheckCircle size={48} className="text-emerald-300" />
        <p className="text-slate-500">¡No se encontraron duplicados!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          <strong className="text-slate-800">{groups.length}</strong> grupos ·
          <strong className="text-red-600 ml-1">{groups.reduce((s, g) => s + g.eliminables, 0)}</strong> eliminables ·
          <strong className="text-blue-600 ml-1">{selectedGroups.size}</strong> seleccionados
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => groups.forEach(g => onToggleSelect(g, true))}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
          >
            Seleccionar todo
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => groups.forEach(g => onToggleSelect(g, false))}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Deseleccionar todo
          </button>
          <span className="text-slate-300">|</span>
          <button onClick={onLoad} disabled={loading} className="text-xs text-slate-400 hover:text-slate-600">
            ↻ Refrescar
          </button>
        </div>
      </div>
      {groups.map(g => (
        <GroupRow
          key={g.grupo_id}
          grupo={g}
          tipo={tipo}
          isSelected={selectedGroups.has(g.grupo_id)}
          onToggleSelect={(grupo) => onToggleSelect(grupo)}
          winnerCode={winnerCodes[g.grupo_id]}
          onChangeWinner={onChangeWinner}
        />
      ))}
    </div>
  );
};

// ── Panel principal ─────────────────────────────────────────────────────────
export default function DeduplicatePanel() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [exactGroups, setExactGroups] = useState([]);
  const [loadingExact, setLoadingExact] = useState(false);
  const [exactLoaded, setExactLoaded] = useState(false);

  const [similarGroups, setSimilarGroups] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarLoaded, setSimilarLoaded] = useState(false);

  const [activeView, setActiveView] = useState('exact');

  // Selección y ganadores
  const [selectedGroups, setSelectedGroups] = useState(new Set()); // Set de grupo_id
  const [winnerCodes, setWinnerCodes] = useState({});              // grupo_id → winner_code
  const [merging, setMerging] = useState(false);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await apiFetch('/dedup/duplicates/stats');
      if (!res.ok) throw new Error('Error al obtener estadísticas');
      setStats(await res.json());
    } catch (err) {
      toast.error(err.message || 'Error de red');
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchExact = async () => {
    setLoadingExact(true);
    setSelectedGroups(new Set());
    setWinnerCodes({});
    try {
      const res = await apiFetch('/dedup/duplicates/exact?limit=300');
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
    setSelectedGroups(new Set());
    setWinnerCodes({});
    toast.loading('Analizando similitudes (10-30 segundos)...', { id: 'similar' });
    try {
      const res = await apiFetch('/dedup/duplicates/similar?threshold=0.85&limit=150');
      if (!res.ok) throw new Error('Error al obtener duplicados similares');
      const data = await res.json();
      setSimilarGroups(data.grupos || []);
      setSimilarLoaded(true);
      toast.success(`${data.total_grupos} grupos similares encontrados`, { id: 'similar' });
    } catch (err) {
      toast.error(err.message || 'Error de red', { id: 'similar' });
    } finally {
      setLoadingSimilar(false);
    }
  };

  const currentGroups = activeView === 'exact' ? exactGroups : similarGroups;

  const handleToggleSelect = (grupo, forceTo = null) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      const shouldAdd = forceTo !== null ? forceTo : !next.has(grupo.grupo_id);
      if (shouldAdd) {
        next.add(grupo.grupo_id);
        // Por defecto el ganador es el de mayor usos en APU
        if (!winnerCodes[grupo.grupo_id]) {
          const sorted = [...grupo.variantes].sort((a, b) => b.usos_en_apu - a.usos_en_apu);
          setWinnerCodes(w => ({ ...w, [grupo.grupo_id]: sorted[0]?.codigo }));
        }
      } else {
        next.delete(grupo.grupo_id);
      }
      return next;
    });
  };

  const handleChangeWinner = (grupoId, newWinner) => {
    setWinnerCodes(w => ({ ...w, [grupoId]: newWinner }));
  };

  const handleMerge = async () => {
    const gruposAFusionar = currentGroups.filter(g => selectedGroups.has(g.grupo_id));
    if (gruposAFusionar.length === 0) return;

    const totalEliminables = gruposAFusionar.reduce((s, g) => s + g.eliminables, 0);
    const confirm = window.confirm(
      `⚠️ ACCIÓN IRREVERSIBLE\n\n` +
      `Vas a fusionar ${gruposAFusionar.length} grupos:\n` +
      `• ${totalEliminables} materiales serán ELIMINADOS de la BD\n` +
      `• Sus referencias en APUs serán redirigidas al ganador de cada grupo\n\n` +
      `¿Confirmas la fusión?`
    );
    if (!confirm) return;

    setMerging(true);
    const toastId = toast.loading(`Fusionando ${gruposAFusionar.length} grupos...`);

    const payload = {
      grupos: gruposAFusionar.map(g => ({
        winner_code: winnerCodes[g.grupo_id] || g.variantes[0]?.codigo,
        loser_codes: g.variantes.map(v => v.codigo).filter(c => c !== (winnerCodes[g.grupo_id] || g.variantes[0]?.codigo))
      }))
    };

    try {
      const res = await apiPost('/dedup/merge', payload);
      if (!res.ok) throw new Error('Error en la fusión');
      const result = await res.json();

      toast.success(
        `✅ Fusión completada: ${result.materiales_eliminados} eliminados · ${result.apus_redirigidas} APUs redirigidas`,
        { id: toastId, duration: 6000 }
      );

      if (result.errores && result.errores.length > 0) {
        toast.error(`⚠️ ${result.errores.length} error(es): ${result.errores[0]}`, { duration: 8000 });
      }

      // Limpiar selección y refrescar listas
      setSelectedGroups(new Set());
      setWinnerCodes({});
      if (activeView === 'exact') {
        setExactLoaded(false);
        setExactGroups([]);
      } else {
        setSimilarLoaded(false);
        setSimilarGroups([]);
      }
      // Refrescar stats
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Error de red', { id: toastId });
    } finally {
      setMerging(false);
    }
  };

  const selectedCount = selectedGroups.size;
  const selectedEliminables = currentGroups
    .filter(g => selectedGroups.has(g.grupo_id))
    .reduce((s, g) => s + g.eliminables, 0);

  return (
    <div className="p-6 h-full flex flex-col gap-5 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Diagnóstico de Materiales Duplicados</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Detecta, revisa y fusiona materiales duplicados. La fusión redirige las APUs automáticamente.
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

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total en BD" value={stats.total_materials} sub="Registros actuales" color="bg-slate-50 border-slate-200 text-slate-800" />
          <StatCard label="Únicos Reales" value={stats.estimated_unique_real} sub="Sin duplicado exacto" color="bg-emerald-50 border-emerald-200 text-emerald-800" />
          <StatCard label="Grupos Duplicados" value={stats.exact_duplicate_groups} sub={`${stats.materials_in_exact_groups} involucrados`} color="bg-orange-50 border-orange-200 text-orange-800" />
          <StatCard label="Eliminables (mín.)" value={stats.estimated_eliminable} sub="Reducción estimada" color="bg-red-50 border-red-200 text-red-800" />
        </div>
      )}

      {/* Botón de fusión flotante — aparece solo cuando hay selección */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between bg-blue-700 text-white rounded-xl px-5 py-3 shadow-lg">
          <div className="text-sm">
            <strong>{selectedCount}</strong> grupo{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''} ·
            <strong className="ml-1">{selectedEliminables}</strong> material{selectedEliminables !== 1 ? 'es' : ''} a eliminar
          </div>
          <button
            onClick={handleMerge}
            disabled={merging}
            className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 px-5 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
          >
            {merging ? <Loader size={16} className="animate-spin" /> : <Merge size={16} />}
            {merging ? 'Fusionando...' : `Fusionar ${selectedCount} grupo${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'exact', label: `Duplicados Exactos${exactLoaded ? ` (${exactGroups.length})` : ''}` },
          { key: 'similar', label: `Duplicados Similares${similarLoaded ? ` (${similarGroups.length})` : ''}` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveView(tab.key); setSelectedGroups(new Set()); }}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeView === tab.key ? 'text-blue-700 border-blue-600 bg-blue-50/60' : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1">
        <GroupList
          groups={currentGroups}
          tipo={activeView}
          loading={activeView === 'exact' ? loadingExact : loadingSimilar}
          loaded={activeView === 'exact' ? exactLoaded : similarLoaded}
          onLoad={activeView === 'exact' ? fetchExact : fetchSimilar}
          loadLabel={
            activeView === 'exact'
              ? 'Detecta materiales con descripción idéntica (normalizada) en la BD.'
              : 'Detecta materiales con descripción similar (≥85%). Toma 10-30 segundos. Los que difieren en dimensiones numéricas se excluyen automáticamente.'
          }
          selectedGroups={selectedGroups}
          onToggleSelect={handleToggleSelect}
          winnerCodes={winnerCodes}
          onChangeWinner={handleChangeWinner}
        />
      </div>
    </div>
  );
}
