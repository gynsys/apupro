import React, { useState, useMemo } from 'react';

// ============================================
// CALCULADORA FCAS - VENEZUELA
// Factor de Costos Asociado al Salario
// ============================================

const CONCEPTOS_DEFAULT = [
  { id: 'vacaciones', nombre: 'Vacaciones + Bono Vacacional', dias: 22, activo: true },
  { id: 'utilidades', nombre: 'Utilidades (30 días)', dias: 30, activo: true },
  { id: 'prestaciones', nombre: 'Prestación Antigüedad (15 días)', dias: 15, activo: true },
  { id: 'aguinaldo', nombre: 'Aguinaldo / Días Adicionales', dias: 15, activo: false },
  { id: 'sso', nombre: 'Seguro Social Obligatorio (11%)', dias: 40, activo: true },
  { id: 'ince', nombre: 'INCE (2%)', dias: 7, activo: true },
  { id: 'lph', nombre: 'Ley Política Habitacional (2%)', dias: 7, activo: true },
  { id: 'feriados', nombre: 'Feriados Nacionales', dias: 12, activo: true },
  { id: 'refrigerio', nombre: 'Refrigerio / Alimentación', dias: 5, activo: false },
  { id: 'utiles', nombre: 'Útiles Escolares', dias: 2, activo: false },
  { id: 'epp', nombre: 'Equipo de Protección Personal', dias: 3, activo: false },
  { id: 'permisos', nombre: 'Permisos Sindicales', dias: 2, activo: false },
];

export default function CalculadoraFCAS({ onClose }) {
  const [salarioBase, setSalarioBase] = useState(500);
  const [diasContratados, setDiasContratados] = useState(365);
  const [diasNoTrabajados, setDiasNoTrabajados] = useState(45);
  const [conceptos, setConceptos] = useState(CONCEPTOS_DEFAULT);
  const [customNombre, setCustomNombre] = useState('');
  const [customDias, setCustomDias] = useState('');

  // ── Cálculos ──────────────────────────────
  const diasPagadosAdicional = useMemo(
    () => conceptos.filter((c) => c.activo).reduce((sum, c) => sum + c.dias, 0),
    [conceptos]
  );

  const fcasPorcentaje = useMemo(() => {
    const denominador = diasContratados - diasNoTrabajados;
    if (denominador <= 0) return 0;
    return ((diasNoTrabajados + diasPagadosAdicional) * 100) / denominador;
  }, [diasContratados, diasNoTrabajados, diasPagadosAdicional]);

  const costoRealMensual = useMemo(
    () => salarioBase * (1 + fcasPorcentaje / 100),
    [salarioBase, fcasPorcentaje]
  );

  const salarioDiario = salarioBase / 30;

  // ── Handlers ──────────────────────────────
  const toggleConcepto = (idx) => {
    setConceptos((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, activo: !c.activo } : c))
    );
  };

  const agregarCustom = () => {
    const nombre = customNombre.trim();
    const dias = parseFloat(customDias);
    if (!nombre || !dias || dias <= 0) return;
    setConceptos((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, nombre, dias, activo: true },
    ]);
    setCustomNombre('');
    setCustomDias('');
  };

  const resetear = () => setConceptos(CONCEPTOS_DEFAULT.map((c) => ({ ...c })));

  // ── Render ────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Calculadora F.C.A.S.</h2>
            <p className="text-sm text-slate-500 mt-1">
              Factor de Costos Asociado al Salario — Venezuela
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Inputs superiores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Salario Base Mensual
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                  $
                </span>
                <input
                  type="number"
                  value={salarioBase}
                  onChange={(e) => setSalarioBase(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Días Contratados (N)
              </label>
              <input
                type="number"
                value={diasContratados}
                onChange={(e) => setDiasContratados(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Días No Trabajados (Ti)
              </label>
              <input
                type="number"
                value={diasNoTrabajados}
                onChange={(e) => setDiasNoTrabajados(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Grid de conceptos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700">Conceptos de Carga Social</h3>
              <button
                onClick={resetear}
                className="text-xs font-medium text-slate-400 hover:text-blue-500 transition-colors"
              >
                Restablecer
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {conceptos.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => toggleConcepto(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    c.activo
                      ? 'bg-blue-50 border-blue-200 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Toggle switch */}
                    <div
                      className={`block w-10 h-6 rounded-full transition-colors relative ${
                        c.activo ? 'bg-blue-500' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          c.activo ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                    <div>
                      <div
                        className={`text-sm font-semibold ${
                          c.activo ? 'text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {c.nombre}
                      </div>
                      <div
                        className={`text-xs ${
                          c.activo ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      >
                        {c.dias} días/año
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-xs font-mono ${
                      c.activo ? 'text-blue-600 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {c.dias}d
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agregar concepto personalizado */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nombre del concepto"
              value={customNombre}
              onChange={(e) => setCustomNombre(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
            />
            <input
              type="number"
              placeholder="Días"
              value={customDias}
              onChange={(e) => setCustomDias(e.target.value)}
              className="w-24 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
            />
            <button
              onClick={agregarCustom}
              className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-95"
            >
              + Agregar
            </button>
          </div>

          {/* Resultados */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* FCAS % */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 cursor-pointer group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  F.C.A.S. %
                </span>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">
                {fcasPorcentaje.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-400 mt-1">Sobre salario base</div>
            </div>

            {/* Días Pagados Adicionalmente */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 cursor-pointer group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Días Pagados Adic. (B)
                </span>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">{diasPagadosAdicional}</div>
              <div className="text-xs text-slate-400 mt-1">días/año</div>
            </div>

            {/* Costo Real Mensual */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 cursor-pointer group hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Costo Real Mensual
                </span>
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">
                ${costoRealMensual.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">con cargas incluidas</div>
            </div>
          </div>

          {/* Fórmula */}
          <div className="bg-slate-900 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Fórmula Aplicada
              </span>
            </div>
            <div className="font-mono text-sm text-slate-300 leading-relaxed">
              <span className="text-blue-400">FCAS</span> ={' '}
              <span className="text-emerald-400">(Ti + B)</span> × 100 /{' '}
              <span className="text-amber-400">(N − Ti)</span>
            </div>
            <div className="font-mono text-xs text-slate-500 mt-2">
              FCAS = ({diasNoTrabajados} + {diasPagadosAdicional}) × 100 / ({diasContratados} − {diasNoTrabajados}) = {fcasPorcentaje.toFixed(2)}%
            </div>
          </div>

          {/* Desglose */}
          <div className="bg-slate-50 rounded-2xl p-5 shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Desglose de Conceptos Activos</h3>
            <div className="space-y-2">
              {conceptos.filter((c) => c.activo).length === 0 ? (
                <div className="text-sm text-slate-400 italic">
                  Selecciona conceptos para ver el desglose...
                </div>
              ) : (
                conceptos
                  .filter((c) => c.activo)
                  .map((c) => {
                    const monto = salarioDiario * c.dias;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-sm text-slate-700">{c.nombre}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900">{c.dias} días</div>
                          <div className="text-xs text-slate-400">
                            ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
