import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Layers,
  ChevronDown,
  ChevronRight,
  Loader,
  Merge,
  Shield,
  Package,
  Wrench,
  Users,
  DollarSign,
  FileText,
  X,
} from 'lucide-react';
import { apiFetch, apiPost } from '../../../lib/apiHelper';

const RESOURCE_CATALOGS = [
  { key: 'materials', label: 'Materiales', singular: 'material', plural: 'materiales', icon: Package },
  { key: 'equipment', label: 'Equipos', singular: 'equipo', plural: 'equipos', icon: Wrench },
  { key: 'labor', label: 'Mano de Obra', singular: 'oficio', plural: 'oficios', icon: Users },
];

const BADGE = ({ count, color }) => (
  <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] text-xs font-bold rounded-full px-2 ${color}`}>
    {count}
  </span>
);

const StatCard = ({ label, value, sub, color, onClick }) => (
  <div
    onClick={onClick}
    className={`rounded-xl p-4 border transition-all ${color} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
  >
    <div className="text-2xl font-extrabold">{value?.toLocaleString('es-VE') ?? '—'}</div>
    <div className="text-sm font-semibold mt-0.5">{label}</div>
    {sub && <div className="text-xs mt-1 opacity-75">{sub}</div>}
  </div>
);

// ── Fila de grupo individual ────────────────────────────────────────────────
const GroupRow = ({
  grupo,
  isSelected,
  onToggleSelect,
  winnerCode,
  onChangeWinner,
  winnerPrice,
  onChangeWinnerPrice,
}) => {
  const [open, setOpen] = useState(false);
  const totalUsos = grupo.variantes.reduce((s, v) => s + (v.usos_en_apu || 0), 0);
  const currentWinner = winnerCode || grupo.variantes[0]?.codigo;
  const distinctPrices = Array.from(
    new Set(grupo.variantes.map(v => Number(v.precio || 0)).filter(p => p > 0))
  ).sort((a, b) => a - b);

  const selectedWinnerObj =
    grupo.variantes.find(v => v.codigo === currentWinner) || grupo.variantes[0];
  const effectivePrice =
    winnerPrice !== undefined && winnerPrice !== null
      ? Number(winnerPrice)
      : Number(selectedWinnerObj?.precio || 0);

  return (
    <div
      className={`border rounded-xl overflow-hidden mb-2.5 transition-colors ${
        isSelected
          ? 'border-blue-400 bg-blue-50/40'
          : grupo.truncated_40char_warning
          ? 'border-amber-300 bg-amber-50/20'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(grupo)}
          className="w-4 h-4 accent-blue-600 shrink-0 cursor-pointer"
        />

        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 text-left min-w-0 cursor-pointer"
        >
          {open ? (
            <ChevronDown size={15} className="text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={15} className="text-slate-400 shrink-0" />
          )}
          <span className="font-semibold text-slate-800 text-sm truncate">
            {grupo.variantes[0]?.descripcion || 'Sin descripción'}
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {grupo.truncated_40char_warning && (
            <span
              title="Algunas variantes tienen exactamente 40 caracteres. Revisa las partidas APU asociadas antes de fusionar."
              className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
            >
              <AlertTriangle size={11} /> 40 chars (Revisar APUs)
            </span>
          )}
          {grupo.unidad_grupo && (
            <BADGE count={grupo.unidad_grupo} color="bg-slate-100 text-slate-700" />
          )}
          {distinctPrices.length > 1 && (
            <BADGE
              count={`$${distinctPrices[0].toFixed(2)} – $${distinctPrices[distinctPrices.length - 1].toFixed(2)}`}
              color="bg-purple-100 text-purple-700"
            />
          )}
          <BADGE count={`${grupo.total_en_grupo} códigos`} color="bg-orange-100 text-orange-700" />
          {totalUsos > 0 && (
            <BADGE count={`${totalUsos} APUs`} color="bg-blue-100 text-blue-700" />
          )}
          <span className="text-xs text-red-600 font-semibold">
            -{grupo.eliminables} a fusionar
          </span>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 overflow-x-auto bg-white">
          {isSelected && (
            <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-4 flex-wrap text-xs text-blue-700">
              <div className="flex items-center gap-2">
                <Shield size={13} />
                <strong>Código ganador (permanece):</strong>
                <select
                  value={currentWinner}
                  onChange={e => onChangeWinner(grupo.grupo_id, e.target.value)}
                  className="ml-1 border border-blue-300 rounded px-2 py-1 text-xs bg-white text-blue-800 font-semibold"
                >
                  {grupo.variantes.map(v => (
                    <option key={v.codigo} value={v.codigo}>
                      {v.codigo} — ${Number(v.precio || 0).toFixed(2)} — {v.descripcion.slice(0, 48)}{' '}
                      ({v.usos_en_apu || 0} APUs)
                    </option>
                  ))}
                </select>
              </div>

              {distinctPrices.length > 1 && (
                <div className="flex items-center gap-2">
                  <DollarSign size={13} />
                  <strong>Precio a conservar:</strong>
                  <select
                    value={effectivePrice}
                    onChange={e => onChangeWinnerPrice(grupo.grupo_id, Number(e.target.value))}
                    className="ml-1 border border-blue-300 rounded px-2 py-1 text-xs bg-white text-blue-800 font-semibold"
                  >
                    {distinctPrices.map(p => (
                      <option key={p} value={p}>
                        ${p.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2 w-3/5">Descripción en BD y Partidas APU Asociadas</th>
                <th className="px-4 py-2 text-center">Unidad</th>
                <th className="px-4 py-2 text-right">Precio</th>
                <th className="px-4 py-2 text-center">Usos APUs</th>
                <th className="px-4 py-2 text-center">Rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grupo.variantes.map(v => {
                const esGanador = v.codigo === currentWinner;
                const samples = v.apus_muestra || [];
                return (
                  <tr key={v.codigo} className={esGanador ? 'bg-emerald-50/70' : ''}>
                    <td className="px-4 py-2.5 font-mono text-blue-700 font-bold align-top">
                      {v.codigo}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 align-top">
                      <div className="font-semibold">{v.descripcion}</div>
                      {samples.length > 0 && (
                        <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-slate-200">
                          {samples.map(ap => (
                            <div
                              key={ap.cod_par}
                              className="text-[11px] text-slate-500 flex items-start gap-1.5"
                            >
                              <FileText size={11} className="text-slate-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="font-mono text-slate-700">{ap.cod_par}:</strong>{' '}
                                {ap.descripcion}
                              </span>
                            </div>
                          ))}
                          {v.usos_en_apu > samples.length && (
                            <div className="text-[10px] text-blue-600 font-medium pl-4">
                              + {v.usos_en_apu - samples.length} partida(s) más…
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-500 align-top">
                      {v.unidad || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold align-top">
                      {v.precio > 0 ? (
                        `$${Number(v.precio).toFixed(2)}`
                      ) : (
                        <span className="text-slate-300">Sin precio</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center align-top">
                      {v.usos_en_apu > 0 ? (
                        <span className="font-bold text-blue-600">{v.usos_en_apu}</span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center align-top">
                      {esGanador ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          ✓ Permanece
                        </span>
                      ) : (
                        <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                          × Fusionar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!isSelected && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
              ☑ Marca la casilla izquierda para incluir este grupo en la fusión
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Panel de lista de grupos ────────────────────────────────────────────────
const GroupList = ({
  groups,
  tipo,
  loading,
  loaded,
  onLoad,
  onSwitchToSimilar,
  similarCount,
  selectedGroups,
  onToggleSelect,
  winnerCodes,
  onChangeWinner,
  winnerPrices,
  onChangeWinnerPrice,
}) => {
  if (loading && !loaded) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-14 text-slate-500">
        <Loader size={36} className="animate-spin text-blue-600" />
        <p className="text-sm font-medium">Analizando grupos de duplicados y trazabilidad APU…</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12">
        <CheckCircle size={48} className="text-emerald-400" />
        <p className="text-slate-700 font-semibold">
          {tipo === 'exact'
            ? '¡0 duplicados exactos pendientes en este catálogo!'
            : '¡No se encontraron duplicados similares pendientes!'}
        </p>
        {tipo === 'exact' && similarCount > 0 && (
          <button
            onClick={onSwitchToSimilar}
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Revisar {similarCount} grupos similares candidatos →
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500">
          <strong className="text-slate-800">{groups.length}</strong> grupos mostrados ·
          <strong className="text-red-600 ml-1">
            {groups.reduce((s, g) => s + g.eliminables, 0)}
          </strong>{' '}
          fusionables ·
          <strong className="text-blue-600 ml-1">{selectedGroups.size}</strong> seleccionados
        </p>
        <div className="flex gap-2">
          <button
            onClick={() =>
              groups.forEach(g => {
                if (!g.truncated_40char_warning) onToggleSelect(g, true);
              })
            }
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
          >
            Seleccionar seguros
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => groups.forEach(g => onToggleSelect(g, false))}
            className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            Deseleccionar todo
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={onLoad}
            disabled={loading}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
          >
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
          onToggleSelect={grupo => onToggleSelect(grupo)}
          winnerCode={winnerCodes[g.grupo_id]}
          onChangeWinner={onChangeWinner}
          winnerPrice={winnerPrices[g.grupo_id]}
          onChangeWinnerPrice={onChangeWinnerPrice}
        />
      ))}
    </div>
  );
};

// ── Panel principal ─────────────────────────────────────────────────────────
export default function DeduplicatePanel() {
  const [resourceType, setResourceType] = useState('materials');
  const currentCatalog =
    RESOURCE_CATALOGS.find(c => c.key === resourceType) || RESOURCE_CATALOGS[0];

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [exactGroups, setExactGroups] = useState([]);
  const [loadingExact, setLoadingExact] = useState(false);
  const [exactLoaded, setExactLoaded] = useState(false);

  const [similarGroups, setSimilarGroups] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarLoaded, setSimilarLoaded] = useState(false);

  const [activeView, setActiveView] = useState('exact');
  const [filterText, setFilterText] = useState('');

  // Selección, ganadores y precios ganadores
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [winnerCodes, setWinnerCodes] = useState({});
  const [winnerPrices, setWinnerPrices] = useState({});
  const [merging, setMerging] = useState(false);

  const fetchStats = async (typeOverride = resourceType) => {
    setLoadingStats(true);
    try {
      const res = await apiFetch(`/dedup/duplicates/stats?resource_type=${typeOverride}`);
      if (!res.ok) throw new Error('Error al obtener estadísticas');
      const data = await res.json();
      setStats(data);
      return data;
    } catch (err) {
      toast.error(err.message || 'Error de red');
      return null;
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchExact = async (typeOverride = resourceType) => {
    setLoadingExact(true);
    setSelectedGroups(new Set());
    setWinnerCodes({});
    setWinnerPrices({});
    try {
      const res = await apiFetch(
        `/dedup/duplicates/exact?resource_type=${typeOverride}&limit=300`
      );
      if (!res.ok) throw new Error('Error al obtener duplicados exactos');
      const data = await res.json();
      setExactGroups(data.grupos || []);
      setExactLoaded(true);
      return data.grupos || [];
    } catch (err) {
      toast.error(err.message || 'Error de red');
      return [];
    } finally {
      setLoadingExact(false);
    }
  };

  const fetchSimilar = async (typeOverride = resourceType) => {
    setLoadingSimilar(true);
    setSelectedGroups(new Set());
    setWinnerCodes({});
    setWinnerPrices({});
    try {
      const res = await apiFetch(
        `/dedup/duplicates/similar?resource_type=${typeOverride}&threshold=0.85&limit=200`
      );
      if (!res.ok) throw new Error('Error al obtener duplicados similares');
      const data = await res.json();
      setSimilarGroups(data.grupos || []);
      setSimilarLoaded(true);
      return data.grupos || [];
    } catch (err) {
      toast.error(err.message || 'Error de red');
      return [];
    } finally {
      setLoadingSimilar(false);
    }
  };

  // Auto-cargar al entrar o cambiar de catálogo
  useEffect(() => {
    let active = true;
    (async () => {
      const st = await fetchStats(resourceType);
      const ex = await fetchExact(resourceType);
      if (active && ex.length === 0 && st && st.similar_duplicate_groups > 0) {
        setActiveView('similar');
        await fetchSimilar(resourceType);
      }
    })();
    return () => {
      active = false;
    };
  }, [resourceType]);

  const handleSwitchCatalog = newType => {
    if (newType === resourceType) return;
    setResourceType(newType);
    setStats(null);
    setExactGroups([]);
    setExactLoaded(false);
    setSimilarGroups([]);
    setSimilarLoaded(false);
    setSelectedGroups(new Set());
    setWinnerCodes({});
    setWinnerPrices({});
    setFilterText('');
    setActiveView('exact');
  };

  const rawGroups = activeView === 'exact' ? exactGroups : similarGroups;
  const currentGroups = filterText.trim()
    ? rawGroups.filter(g => {
        const q = filterText.trim().toLowerCase();
        return g.variantes.some(
          v =>
            v.codigo?.toLowerCase().includes(q) ||
            v.descripcion?.toLowerCase().includes(q) ||
            (v.apus_muestra || []).some(
              ap =>
                ap.cod_par?.toLowerCase().includes(q) ||
                ap.descripcion?.toLowerCase().includes(q)
            )
        );
      })
    : rawGroups;

  const handleToggleSelect = (grupo, forceTo = null) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      const shouldAdd = forceTo !== null ? forceTo : !next.has(grupo.grupo_id);
      if (shouldAdd) {
        next.add(grupo.grupo_id);
        if (!winnerCodes[grupo.grupo_id]) {
          const sorted = [...grupo.variantes].sort(
            (a, b) => (b.usos_en_apu || 0) - (a.usos_en_apu || 0)
          );
          const defaultWinner = sorted[0]?.codigo;
          setWinnerCodes(w => ({ ...w, [grupo.grupo_id]: defaultWinner }));
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

  const handleChangeWinnerPrice = (grupoId, newPrice) => {
    setWinnerPrices(p => ({ ...p, [grupoId]: newPrice }));
  };

  const handleMerge = async () => {
    const gruposAFusionar = rawGroups.filter(g => selectedGroups.has(g.grupo_id));
    if (gruposAFusionar.length === 0) return;

    const totalEliminables = gruposAFusionar.reduce((s, g) => s + g.eliminables, 0);
    const confirm = window.confirm(
      `⚠️ ACCIÓN IRREVERSIBLE (${currentCatalog.label})\n\n` +
        `Vas a fusionar ${gruposAFusionar.length} grupos:\n` +
        `• ${totalEliminables} ${currentCatalog.plural} serán ELIMINADOS de la BD\n` +
        `• Sus referencias en APUs serán redirigidas al ganador de cada grupo\n\n` +
        `¿Confirmas la fusión?`
    );
    if (!confirm) return;

    setMerging(true);
    const toastId = toast.loading(`Fusionando ${gruposAFusionar.length} grupos...`);

    const payload = {
      resource_type: resourceType,
      grupos: gruposAFusionar.map(g => {
        const wCode = winnerCodes[g.grupo_id] || g.variantes[0]?.codigo;
        const wPrice = winnerPrices[g.grupo_id];
        return {
          winner_code: wCode,
          loser_codes: g.variantes.map(v => v.codigo).filter(c => c !== wCode),
          ...(wPrice !== undefined && wPrice !== null ? { winner_price: Number(wPrice) } : {}),
        };
      }),
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
        toast.error(`⚠️ ${result.errores.length} error(es): ${result.errores[0]}`, {
          duration: 8000,
        });
      }

      setSelectedGroups(new Set());
      setWinnerCodes({});
      setWinnerPrices({});
      await fetchStats(resourceType);
      if (activeView === 'exact') {
        await fetchExact(resourceType);
      } else {
        await fetchSimilar(resourceType);
      }
    } catch (err) {
      toast.error(err.message || 'Error de red', { id: toastId });
    } finally {
      setMerging(false);
    }
  };

  const selectedCount = selectedGroups.size;
  const selectedEliminables = rawGroups
    .filter(g => selectedGroups.has(g.grupo_id))
    .reduce((s, g) => s + g.eliminables, 0);

  return (
    <div className="p-6 h-full flex flex-col gap-5 overflow-auto">
      {/* Header + Selector de Catálogo */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Diagnóstico y Saneamiento de Duplicados ({currentCatalog.label})
          </h2>
          <p className="text-slate-500 mt-1 text-sm">
            Detecta, revisa las Partidas APU asociadas y fusiona {currentCatalog.plural} duplicados
            por unidad física equivalente y sin conflictos de diámetro/especificación.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            {RESOURCE_CATALOGS.map(cat => {
              const Icon = cat.icon;
              const active = resourceType === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => handleSwitchCatalog(cat.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon size={14} />
                  {cat.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={async () => {
              await fetchStats(resourceType);
              if (activeView === 'exact') await fetchExact(resourceType);
              else await fetchSimilar(resourceType);
            }}
            disabled={loadingStats || loadingExact || loadingSimilar}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loadingStats ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
            Recalcular
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total en BD"
            value={stats.total_materials}
            sub={`Registros en ${currentCatalog.label}`}
            color="bg-slate-50 border-slate-200 text-slate-800"
          />
          <StatCard
            label="Únicos Estimados"
            value={stats.estimated_unique_real}
            sub="Catálogo depurado"
            color="bg-emerald-50 border-emerald-200 text-emerald-800"
          />
          <StatCard
            label="Grupos Exactos"
            value={stats.exact_duplicate_groups}
            sub={`${stats.estimated_eliminable || 0} fusionables directos`}
            color="bg-orange-50 border-orange-200 text-orange-800"
            onClick={() => {
              setActiveView('exact');
              if (!exactLoaded) fetchExact(resourceType);
            }}
          />
          <StatCard
            label="Grupos Similares"
            value={stats.similar_duplicate_groups ?? 0}
            sub={`${stats.similar_eliminable ?? 0} candidatos por similitud`}
            color="bg-blue-50 border-blue-200 text-blue-800"
            onClick={() => {
              setActiveView('similar');
              if (!similarLoaded) fetchSimilar(resourceType);
            }}
          />
        </div>
      )}

      {/* Botón de fusión flotante */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between bg-blue-700 text-white rounded-xl px-5 py-3 shadow-lg">
          <div className="text-sm">
            <strong>{selectedCount}</strong> grupo{selectedCount !== 1 ? 's' : ''} seleccionado
            {selectedCount !== 1 ? 's' : ''} ·
            <strong className="ml-1">{selectedEliminables}</strong>{' '}
            {selectedEliminables !== 1 ? currentCatalog.plural : currentCatalog.singular} a fusionar
          </div>
          <button
            onClick={handleMerge}
            disabled={merging}
            className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 px-5 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {merging ? <Loader size={16} className="animate-spin" /> : <Merge size={16} />}
            {merging
              ? 'Fusionando...'
              : `Fusionar ${selectedCount} grupo${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Sub-tabs + Buscador */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 flex-wrap pb-2">
        <div className="flex gap-2">
          {[
            {
              key: 'exact',
              label: `Duplicados Exactos (${
                exactLoaded ? exactGroups.length : stats?.exact_duplicate_groups ?? '…'
              })`,
            },
            {
              key: 'similar',
              label: `Duplicados Similares (${
                similarLoaded ? similarGroups.length : stats?.similar_duplicate_groups ?? '…'
              })`,
            },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveView(tab.key);
                setSelectedGroups(new Set());
                if (tab.key === 'exact' && !exactLoaded) fetchExact(resourceType);
                if (tab.key === 'similar' && !similarLoaded) fetchSimilar(resourceType);
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                activeView === tab.key
                  ? 'text-blue-700 bg-blue-50 border border-blue-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filtrar por código, descripción o partida APU..."
            className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <GroupList
          groups={currentGroups}
          tipo={activeView}
          loading={activeView === 'exact' ? loadingExact : loadingSimilar}
          loaded={activeView === 'exact' ? exactLoaded : similarLoaded}
          onLoad={() =>
            activeView === 'exact' ? fetchExact(resourceType) : fetchSimilar(resourceType)
          }
          onSwitchToSimilar={() => {
            setActiveView('similar');
            if (!similarLoaded) fetchSimilar(resourceType);
          }}
          similarCount={stats?.similar_duplicate_groups || 0}
          selectedGroups={selectedGroups}
          onToggleSelect={handleToggleSelect}
          winnerCodes={winnerCodes}
          onChangeWinner={handleChangeWinner}
          winnerPrices={winnerPrices}
          onChangeWinnerPrice={handleChangeWinnerPrice}
        />
      </div>
    </div>
  );
}
