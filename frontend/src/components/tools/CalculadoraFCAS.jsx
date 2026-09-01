import React, { useState, useMemo, useEffect } from 'react';

// ============================================
// CALCULADORA FCAS PROFESIONAL - VENEZUELA
// CON DÍAS EQUIVALENTES (COSTO REAL)
// ============================================

const CONCEPTOS_DEFAULT = [
  { id: 'vacaciones', nombre: 'Vacaciones + Bono Vacacional', dias: 240, activo: true },
  { id: 'utilidades', nombre: 'Utilidades Convención Colectiva', dias: 580, activo: true },
  { id: 'prestaciones', nombre: 'Garantía Prestaciones (LOTTT)', dias: 650, activo: true },
  { id: 'sso', nombre: 'Seguro Social Obligatorio (11%)', dias: 180, activo: true },
  { id: 'ince', nombre: 'INCES (2%)', dias: 45, activo: true },
  { id: 'lph', nombre: 'Ley Política Habitacional (2%)', dias: 45, activo: true },
  { id: 'feriados', nombre: 'Feriados Nacionales', dias: 12, activo: true },
  { id: 'permisos', nombre: 'Cláusulas / Permisos Construcción', dias: 1162, activo: true },
];

export default function CalculadoraFCAS({ onClose, onUseFCAS }) {
  // ── Estados Base ──────────────────────────────────────────
  const [metodo, setMetodo] = useState('indexado');
  const [salarioBase, setSalarioBase] = useState(240); // $240 mensuales (8$/día)
  const [bonoIndexado, setBonoIndexado] = useState(175); // Cestaticket $175 mensual
  const [diasContratados, setDiasContratados] = useState(365); // Período anual por defecto
  const [diasNoTrabajados, setDiasNoTrabajados] = useState(96); // Valor inicial (se recalculará)
  const [conceptos, setConceptos] = useState(CONCEPTOS_DEFAULT);
  const [calculoAutomatico, setCalculoAutomatico] = useState(true);

  // ── Cálculo automático de días de descanso ──────────────
  const diasDescansoAutomaticos = useMemo(() => {
    if (diasContratados <= 0) return 0;
    // Fines de semana (2 de cada 7 días)
    const finesSemana = diasContratados * (2 / 7);
    // Feriados nacionales (12 al año, proporcionales)
    const feriados = 12 * (diasContratados / 365);
    // Redondeamos hacia arriba para no quedarnos cortos
    return Math.ceil(finesSemana + feriados);
  }, [diasContratados]);

  // Sincronizar díasNoTrabajados con el cálculo automático
  useEffect(() => {
    if (calculoAutomatico) {
      setDiasNoTrabajados(diasDescansoAutomaticos);
    }
  }, [calculoAutomatico, diasDescansoAutomaticos]);

  // ── Motores de Cálculo Reactivos ────────────────────────
  const salarioDiario = useMemo(() => {
    return salarioBase > 0 ? salarioBase / 30 : 0;
  }, [salarioBase]);

  const diasPagadosAnuales = useMemo(() => {
    return conceptos.filter((c) => c.activo).reduce((sum, c) => sum + c.dias, 0);
  }, [conceptos]);

  // FÓRMULA CORREGIDA (suma diasContratados en el numerador)
  const fcasPorcentaje = useMemo(() => {
    const diasLaboradosReales = diasContratados - diasNoTrabajados;
    if (diasLaboradosReales <= 0 || salarioDiario <= 0) return 0;

    // Proporción del período frente al año base
    const factorTemporal = diasContratados / 365;
    const diasPagadosProporcionales = diasPagadosAnuales * factorTemporal;

    let diasEquivalentesBono = 0;
    if (metodo === 'indexado' && bonoIndexado > 0) {
      const costoBonoPeriodo = (bonoIndexado / 30) * diasContratados;
      diasEquivalentesBono = costoBonoPeriodo / salarioDiario;
    }

    // NUEVO: se suma diasContratados (salario base de todos los días del período)
    const totalNumeradorDias = diasContratados + diasPagadosProporcionales + diasEquivalentesBono;

    return (totalNumeradorDias / diasLaboradosReales) * 100;
  }, [metodo, salarioBase, salarioDiario, bonoIndexado, diasContratados, diasNoTrabajados, diasPagadosAnuales]);

  const costoRealMensual = useMemo(() => {
    if (metodo === 'indexado') {
      return salarioBase * (1 + fcasPorcentaje / 100);
    }
    return salarioBase * (1 + fcasPorcentaje / 100) + bonoIndexado;
  }, [salarioBase, fcasPorcentaje, metodo, bonoIndexado]);

  // ── Handlers ──────────────────────────────────────────────
  const toggleConcepto = (idx) => {
    setConceptos((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, activo: !c.activo } : c))
    );
  };

  const resetear = () => setConceptos(CONCEPTOS_DEFAULT.map((c) => ({ ...c })));

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200/60 print:border-none">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 print:bg-white print:shadow-none">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">
              Calculadora de Costos de Construcción
            </h1>
            <p className="text-xs text-slate-500 mt-1">Análisis Dinámico de Factor de Costos Asociados al Salario</p>
          </div>
          
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => onUseFCAS && onUseFCAS(fcasPorcentaje)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Usar FCAS
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900"
              title="Imprimir o guardar como PDF"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 print:p-4">
          {/* Selector de Método */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit print:border print:bg-white">
            <button
              type="button"
              onClick={() => setMetodo('estandar')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                metodo === 'estandar'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Método Estándar LOTTT
            </button>
            <button
              type="button"
              onClick={() => setMetodo('indexado')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                metodo === 'indexado'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Método Con Bonos Indexados
            </button>
          </div>

          {/* Indicadores Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5 bg-white/70 backdrop-blur-sm border border-slate-200/70 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Factor F.C.A.S. Calculado</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-4xl font-black ${metodo === 'indexado' ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {fcasPorcentaje.toFixed(2)}%
                </span>
                <span className="text-xs text-slate-500 font-medium">del salario base</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                {metodo === 'indexado'
                  ? '💡 Simulación de Alta Intensidad: Absorbe bonificaciones fijas sobre salarios de tabulador deprimidos.'
                  : '📋 Factor Prestacional Base: No incluye la distorsión matemática del Cestaticket.'}
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-white/70 backdrop-blur-sm border border-slate-200/70 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Costo Real de Mano de Obra (Mensual)</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-800">${costoRealMensual.toFixed(2)}</span>
                <span className="text-sm font-semibold text-slate-500">USD / Obrero</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-3 grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                  Salario Diario Base: <b className="text-slate-700">${salarioDiario.toFixed(2)}</b>
                </div>
                <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                  Días de Obra Reales: <b className="text-slate-700">{diasContratados - diasNoTrabajados} días</b>
                </div>
              </div>
            </div>
          </div>

          {/* Inputs de Control */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/60">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Salario Base Mensual (USD)</label>
              <input
                type="number"
                value={salarioBase}
                onChange={(e) => setSalarioBase(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bono / Cestaticket Indexado</label>
              <input
                type="number"
                disabled={metodo !== 'indexado'}
                value={bonoIndexado}
                onChange={(e) => setBonoIndexado(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Días Ejecución (N)</label>
              <input
                type="number"
                value={diasContratados}
                onChange={(e) => setDiasContratados(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-full bg-white rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Días de Descanso (Ti)</label>
                <button
                  type="button"
                  onClick={() => setCalculoAutomatico(!calculoAutomatico)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    calculoAutomatico ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {calculoAutomatico ? '🔒 Auto' : '✏️ Manual'}
                </button>
              </div>
              <input
                type="number"
                value={diasNoTrabajados}
                onChange={(e) => {
                  setCalculoAutomatico(false);
                  setDiasNoTrabajados(Math.min(diasContratados, parseFloat(e.target.value) || 0));
                }}
                className={`w-full bg-white rounded-xl border px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none focus:ring-1 ${
                  calculoAutomatico 
                    ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800' 
                    : 'border-slate-300 focus:border-blue-500'
                }`}
              />
              {calculoAutomatico && (
                <p className="text-[10px] text-emerald-600 mt-1">
                  (Fines de semana + feriados)
                </p>
              )}
            </div>
          </div>

          {/* Matriz de Incidencias */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Matriz de Incidencias Laborales (Días Equivalentes)</span>
              <button
                type="button"
                onClick={resetear}
                className="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-lg text-slate-700 transition-colors print:hidden"
              >
                Resetear Matriz
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {conceptos.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => toggleConcepto(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    c.activo
                      ? 'bg-white/80 border-slate-300 shadow-sm'
                      : 'bg-slate-50/40 border-slate-200/60 opacity-50 hover:opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${c.activo ? (metodo === 'indexado' ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-slate-300'}`} />
                    <span className="text-sm text-slate-700">{c.nombre}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">{c.dias} días</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}