import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  ShieldCheck, 
  Cpu 
} from 'lucide-react';
import GlassCard from '../../../../components/shared/GlassCard';
import { apiPost } from '../../../../lib/apiHelper';
import toast from 'react-hot-toast';

const PRESET_QUERIES = [
  {
    title: 'Paredes de Adobe (Albañilería)',
    query: 'Construcción Paredes adobe unidad m²',
    expected: 'Base mampostería arcilla/adobe y 0 complementarias (autosuficiente)'
  },
  {
    title: 'Demolición con Bote',
    query: 'Demolición losa concreto con bote a 10 km',
    expected: 'Base demolición + 1 complementaria (transporte/bote)'
  },
  {
    title: 'Pared con Friso y Pintura',
    query: 'Construcción pared bloques arcilla con friso y pintura',
    expected: 'Base mampostería + 2 complementarias (friso y pintura)'
  },
  {
    title: 'Vaciado de Concreto en Vigas',
    query: 'Vaciado de concreto 210 kg/cm2 en vigas unidad m3',
    expected: 'Base concreto estructural en vigas (penaliza mampostería/suelos)'
  }
];

const RAGDiagnosticTab = () => {
  const [query, setQuery] = useState('Construcción Paredes adobe unidad m²');
  const [coveninPrefix, setCoveninPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);

  // Test Suite state
  const [testSuiteRunning, setTestSuiteRunning] = useState(false);
  const [testSuiteResults, setTestSuiteResults] = useState(null);

  const runDiagnostic = async (searchQuery = query, prefix = coveninPrefix) => {
    if (!searchQuery.trim()) {
      toast.error('Ingresa una descripción para diagnosticar');
      return;
    }

    setLoading(true);
    try {
      const response = await apiPost('/cost360/rag-diagnostic', {
        query: searchQuery.trim(),
        covenin_prefix: prefix.trim()
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al ejecutar diagnóstico RAG');
      }

      const data = await response.json();
      setDiagnosticData(data);
      toast.success('Diagnóstico RAG completado');
    } catch (error) {
      toast.error(error.message || 'Error de conexión con el motor RAG');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const runFullTestSuite = async () => {
    setTestSuiteRunning(true);
    setTestSuiteResults([]);
    const results = [];

    for (let i = 0; i < PRESET_QUERIES.length; i++) {
      const test = PRESET_QUERIES[i];
      try {
        const response = await apiPost('/cost360/rag-diagnostic', {
          query: test.query,
          covenin_prefix: ''
        });

        if (response.ok) {
          const data = await response.json();
          let passed = false;
          let details = '';

          if (i === 0) {
            const desc = (data.ganadora?.descripcion || '').toUpperCase();
            const esMamposteria = desc.includes('PARED') || desc.includes('BLOQUE') || desc.includes('ARCILLA') || desc.includes('ADOBE');
            const esAutosuficiente = data.es_autosuficiente;
            passed = esMamposteria && esAutosuficiente;
            details = `Ganadora: [${data.ganadora?.codpar || 'N/A'}] ${(data.ganadora?.descripcion || '').slice(0, 45)}... | Complementarias: ${data.complementarias?.length || 0}`;
          } else if (i === 1) {
            const tieneComp = (data.complementarias || []).some(c => 
              (c.descripcion || '').toUpperCase().includes('TRANSPORTE') || 
              (c.descripcion || '').toUpperCase().includes('BOTE') ||
              (c.descripcion || '').toUpperCase().includes('CARGA')
            );
            passed = tieneComp;
            details = `Complementarias detectadas: ${data.complementarias?.length || 0} (${(data.complementarias || []).map(c => c.codpar).join(', ') || 'Ninguna'})`;
          } else if (i === 2) {
            passed = (data.complementarias || []).length >= 1;
            details = `Complementarias detectadas: ${data.complementarias?.length || 0}`;
          } else if (i === 3) {
            const desc = (data.ganadora?.descripcion || '').toUpperCase();
            passed = desc.includes('CONCRETO') || desc.includes('VIGA') || (data.best_score >= 0.65);
            details = `Score ganadora: ${data.best_score} | ${data.ganadora?.codpar || ''}`;
          }

          results.push({
            title: test.title,
            query: test.query,
            expected: test.expected,
            passed,
            details,
            data
          });
        } else {
          results.push({
            title: test.title,
            query: test.query,
            expected: test.expected,
            passed: false,
            details: 'Error en respuesta HTTP del backend'
          });
        }
      } catch (err) {
        results.push({
          title: test.title,
          query: test.query,
          expected: test.expected,
          passed: false,
          details: `Fallo: ${err.message}`
        });
      }
    }

    setTestSuiteResults(results);
    setTestSuiteRunning(false);
    toast.success('Batería de pruebas finalizada');
  };

  const getScoreColor = (score) => {
    if (score >= 0.70) return 'text-emerald-700 bg-emerald-100 border-emerald-300';
    if (score >= 0.45) return 'text-blue-700 bg-blue-100 border-blue-300';
    if (score >= 0.30) return 'text-amber-700 bg-amber-100 border-amber-300';
    return 'text-rose-700 bg-rose-100 border-rose-300';
  };

  const getProgressColor = (score) => {
    if (score >= 0.70) return 'bg-emerald-500';
    if (score >= 0.45) return 'bg-blue-500';
    if (score >= 0.30) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
      {/* HEADER & CONTROL CARD */}
      <GlassCard className="rounded-2xl p-5 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Cpu className="text-blue-600" size={20} />
              Diagnóstico RAG Híbrido & Playground de Pruebas
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Inspecciona en tiempo real la normalización de sinónimos técnicos, ranking de candidatos y decisión de partidas complementarias.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={runFullTestSuite}
              disabled={testSuiteRunning || loading}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {testSuiteRunning ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              Batería de Pruebas
            </button>
          </div>
        </div>

        {/* INPUT DE PRUEBA */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runDiagnostic()}
              placeholder="Escribe una descripción técnica para evaluar el RAG (ej: Construcción Paredes adobe unidad m²)..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner"
            />
            <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
          </div>

          <div className="w-full sm:w-40">
            <input
              type="text"
              value={coveninPrefix}
              onChange={(e) => setCoveninPrefix(e.target.value)}
              placeholder="Prefijo (opcional)"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Filtrar opcionalmente por prefijo COVENIN como E411, E313, C311"
            />
          </div>

          <button
            onClick={() => runDiagnostic()}
            disabled={loading || !query.trim()}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Diagnosticar
          </button>
        </div>

        {/* PRESETS RÁPIDOS */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200/80">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Casos de Prueba:</span>
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(preset.query);
                setCoveninPrefix('');
                runDiagnostic(preset.query, '');
              }}
              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg border border-slate-200 transition-colors font-medium text-left"
              title={preset.expected}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* BATERÍA DE PRUEBAS RESULTADOS */}
      {testSuiteResults && (
        <GlassCard className="rounded-2xl p-5 border border-indigo-200 bg-indigo-50/40 animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
              <ShieldCheck className="text-indigo-600" size={18} />
              Resultado de la Batería de Pruebas Rápidas ({testSuiteResults.filter(r => r.passed).length}/{testSuiteResults.length} Exitosas)
            </h3>
            <button
              onClick={() => setTestSuiteResults(null)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {testSuiteResults.map((test, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all ${
                  test.passed 
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                    : 'bg-rose-50/80 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {test.passed ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold">{test.title}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    test.passed ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                  }`}>
                    {test.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono mt-1 line-clamp-1">
                  Query: "{test.query}"
                </p>
                <p className="text-[11px] font-medium text-slate-700 mt-1">
                  {test.details}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* DIAGNOSTIC RESULTS */}
      {diagnosticData && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
          {/* TARJETA 1: NORMALIZACIÓN & SINÓNIMOS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard className="rounded-2xl p-4 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paso 1: Normalización de Sinónimos</span>
                <p className="text-xs text-slate-600 mt-1">
                  Expansión léxica con diccionario técnico venezolano:
                </p>
                <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="text-[11px] text-slate-500 font-medium">Original: <span className="font-mono text-slate-800 font-semibold">{diagnosticData.query_original}</span></div>
                  <div className="text-[11px] text-blue-700 font-medium">Expandida: <span className="font-mono font-bold">{diagnosticData.query_expandida}</span></div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                  diagnosticData.sinonimos_aplicados 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {diagnosticData.sinonimos_aplicados ? '✓ Sinónimos Técnicos Expandidos' : 'Sinónimos No Requeridos'}
                </span>
              </div>
            </GlassCard>

            {/* TARJETA 2: PARTIDA BASE GANADORA */}
            <GlassCard className="rounded-2xl p-4 border border-blue-200 bg-blue-50/30 flex flex-col justify-between md:col-span-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-blue-600" />
                    Paso 2: Partida Base Ganadora (Top 1)
                  </span>
                  {diagnosticData.ganadora && (
                    <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border ${getScoreColor(diagnosticData.ganadora.score)}`}>
                      Score: {diagnosticData.ganadora.score}
                    </span>
                  )}
                </div>

                {diagnosticData.ganadora ? (
                  <div className="mt-2">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-mono font-bold rounded-md">
                        {diagnosticData.ganadora.covenin || diagnosticData.ganadora.codpar}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        Unidad: {diagnosticData.ganadora.unidad || 'm²'}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        Rend: {diagnosticData.ganadora.rendimiento || 1.0} día
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 leading-snug uppercase">
                      {diagnosticData.ganadora.descripcion}
                    </p>

                    {diagnosticData.base_apu && (
                      <div className="mt-2.5 flex items-center gap-4 text-xs font-medium text-slate-600 border-t border-blue-200/60 pt-2">
                        <span>📦 <strong>{diagnosticData.base_apu.total_materiales}</strong> Materiales</span>
                        <span>🚜 <strong>{diagnosticData.base_apu.total_equipos}</strong> Equipos</span>
                        <span>👷 <strong>{diagnosticData.base_apu.total_mano_obra}</strong> Mano de Obra</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No se encontró partida base candidata con suficiente similitud.
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* TARJETA 3: ESTADO DE COMPLEMENTARIAS */}
          <GlassCard className="rounded-2xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-600" />
                Paso 3: Decisión de Partidas Complementarias (Auto-Fusión)
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                diagnosticData.es_autosuficiente 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-indigo-100 text-indigo-800'
              }`}>
                {diagnosticData.es_autosuficiente ? 'Partida Autosuficiente (0 complementarias)' : `${diagnosticData.complementarias.length} Complementaria(s) Seleccionada(s)`}
              </span>
            </div>

            {diagnosticData.es_autosuficiente ? (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  <strong>Análisis de Relevancia:</strong> La solicitud describe una actividad autosuficiente. No se inyectaron complementarias para no contaminar el APU con insumos ajenos.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {diagnosticData.complementarias.map((comp, idx) => (
                  <div key={idx} className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-indigo-600 text-white text-[11px] font-mono font-bold rounded">
                          {comp.covenin || comp.codpar}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200 uppercase">
                          Complementaria #{idx + 1}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 line-clamp-2 uppercase">
                        {comp.descripcion}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* TABLA: TOP 15 CANDIDATAS */}
          <GlassCard className="rounded-2xl p-4 border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers size={14} className="text-slate-500" />
                Ranking de Candidatas Evaluadas por Similitud RAG (Top {diagnosticData.candidatas?.length || 0})
              </h3>
              <span className="text-[11px] text-slate-500">
                Mejor Similitud: <strong>{diagnosticData.best_score}</strong>
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-bold w-12 text-center">#</th>
                    <th className="py-2.5 px-3 font-bold w-28">Código</th>
                    <th className="py-2.5 px-3 font-bold">Descripción Técnica</th>
                    <th className="py-2.5 px-3 font-bold w-16 text-center">Unidad</th>
                    <th className="py-2.5 px-3 font-bold w-20 text-center">Rend.</th>
                    <th className="py-2.5 px-3 font-bold w-36 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {diagnosticData.candidatas?.map((cand, idx) => (
                    <tr 
                      key={idx} 
                      className={`hover:bg-slate-50 transition-colors ${idx === 0 ? 'bg-blue-50/40 font-semibold' : ''}`}
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono text-slate-700">{cand.covenin || cand.codpar}</td>
                      <td className="py-2 px-3 text-slate-800 line-clamp-1 leading-normal uppercase">{cand.descripcion}</td>
                      <td className="py-2 px-3 text-center text-slate-600">{cand.unidad || '-'}</td>
                      <td className="py-2 px-3 text-center text-slate-600">{cand.rendimiento || 1.0}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${getProgressColor(cand.score)}`}
                              style={{ width: `${Math.min(100, Math.max(0, cand.score * 100))}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-slate-700 w-10 text-right">
                            {cand.score}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default RAGDiagnosticTab;
