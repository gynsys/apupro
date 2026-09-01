import React, { useState, useMemo } from 'react';

// ============================================
// CALCULADORA FCAS PROFESIONAL - VENEZUELA
// ============================================

const CONCEPTOS_DEFAULT = [
  { id: 'vacaciones', nombre: 'Vacaciones + Bono Vacacional', dias: 22, activo: true },
  { id: 'utilidades', nombre: 'Utilidades Convención Colectiva', dias: 120, activo: true },
  { id: 'prestaciones', nombre: 'Garantía Prestaciones (LOTTT)', dias: 60, activo: true },
  { id: 'sso', nombre: 'Seguro Social Obligatorio (11%)', dias: 40, activo: true },
  { id: 'ince', nombre: 'INCES (2%)', dias: 7, activo: true },
  { id: 'lph', nombre: 'Ley Política Habitacional (2%)', dias: 7, activo: true },
  { id: 'feriados', nombre: 'Feriados Nacionales', dias: 12, activo: true },
  { id: 'permisos', nombre: 'Cláusulas / Permisos Construcción', dias: 15, activo: true },
];

export default function CalculadoraFCAS({ onClose }) {
  // ── Estados Base ──────────────────────────────────────────
  const [metodo, setMetodo] = useState('indexado');
  const [salarioBase, setSalarioBase] = useState(60);
  const [bonoIndexado, setBonoIndexado] = useState(240);
  const [diasContratados, setDiasContratados] = useState(30);
  const [diasNoTrabajados, setDiasNoTrabajados] = useState(8);
  const [conceptos, setConceptos] = useState(CONCEPTOS_DEFAULT);

  // ── Motores de Cálculo Reactivos ────────────────────────
  const salarioDiario = useMemo(() => {
    return salarioBase > 0 ? salarioBase / 30 : 0;
  }, [salarioBase]);

  const diasPagadosAnuales = useMemo(() => {
    return conceptos.filter((c) => c.activo).reduce((sum, c) => sum + c.dias, 0);
  }, [conceptos]);

  const fcasPorcentaje = useMemo(() => {
    const denominador = diasContratados - diasNoTrabajados;
    if (denominador <= 0 || salarioDiario <= 0) return 0;

    const factorTemporal = diasContratados / 365;
    const diasPagadosProporcionales = diasPagadosAnuales * factorTemporal;

    let diasEquivalentesBono = 0;
    if (metodo === 'indexado' && bonoIndexado > 0) {
      const costoBonoEnLaObra = (bonoIndexado / 30) * diasContratados;
      diasEquivalentesBono = costoBonoEnLaObra / salarioDiario;
    }

    const totalNumeradorDias = diasNoTrabajados + diasPagadosProporcionales + diasEquivalentesBono;

    return (totalNumeradorDias * 100) / denominador;
  }, [metodo, salarioBase, salarioDiario, bonoIndexado, diasContratados, diasNoTrabajados, diasPagadosAnuales]);

  const costoRealMensual = useMemo(() => {
    if (metodo === 'indexado') {
      return salarioBase * (1 + fcasPorcentaje / 100);
    }
    return salarioBase * (1 + fcasPorcentaje / 100) + bonoIndexado;
  }, [salarioBase, fcasPorcentaje, metodo, bonoIndexado]);

  // ── Handlers de Interfaz ──────────────────────────────────
  const toggleConcepto = (idx) => {
    setConceptos((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, activo: !c.activo } : c))
    );
  };

  const resetear = () => setConceptos(CONCEPTOS_DEFAULT.map((c) => ({ ...c })));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700/50">
        
        {/* Header Modal */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700/50 px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Calculadora de Costos de Construcción
            </h2>
            <p className="text-xs text-slate-400 mt-1">Análisis Dinámico de Factor de Costos Asociados al Salario</p>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Selector de Método */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700 w-fit">
            <button
              type="button"
              onClick={() => setMetodo('estandar')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                metodo === 'estandar'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
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
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Método Con Bonos Indexados
            </button>
          </div>

          {/* Bloque de Indicadores Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/50 rounded-2xl p-5 border border-slate-700/60 flex flex-col justify-between">
              <span className="text-xs font-bold tracking-widest uppercase text-slate-400">Factor F.C.A.S. Calculado</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-4xl font-black ${metodo === 'indexado' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {fcasPorcentaje.toFixed(2)}%
                </span>
                <span className="text-xs text-slate-500 font-medium">del salario base</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 bg-slate-900 p-2 rounded-lg border border-slate-800">
                {metodo === 'indexado'
                  ? '💡 Simulación de Alta Intensidad: Absorbe bonificaciones fijas sobre salarios de tabulador deprimidos.'
                  : '📋 Factor Prestacional Base: No incluye la distorsión matemática del Cestaticket.'}
              </p>
            </div>

            <div className="bg-slate-950/50 rounded-2xl p-5 border border-slate-700/60 flex flex-col justify-between">
              <span className="text-xs font-bold tracking-widest uppercase text-slate-400">Costo Real de Mano de Obra (Mensual)</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">${costoRealMensual.toFixed(2)}</span>
                <span className="text-sm font-semibold text-slate-400">USD / Obrero</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-3 grid grid-cols-2 gap-2">
                <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                  Salario Diario Base: <b className="text-white">${salarioDiario.toFixed(2)}</b>
                </div>
                <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                  Días de Obra Reales: <b className="text-white">{diasContratados - diasNoTrabajados} días</b>
                </div>
              </div>
            </div>
          </div>

          {/* Inputs de Control */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/20 p-4 rounded-2xl border border-slate-800">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salario Base (Tabulador)</label>
              <input
                type="number"
                value={salarioBase}
                onChange={(e) => setSalarioBase(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-900 rounded-xl border border-slate-700 px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bono / Cestaticket Indexado</label>
              <input
                type="number"
                disabled={metodo !== 'indexado'}
                value={bonoIndexado}
                onChange={(e) => setBonoIndexado(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-900 rounded-xl border border-slate-700 px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Días Ejecución (N)</label>
              <input
                type="number"
                value={diasContratados}
                onChange={(e) => setDiasContratados(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-900 rounded-xl border border-slate-700 px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Días de Descanso (Ti)</label>
              <input
                type="number"
                value={diasNoTrabajados}
                onChange={(e) => setDiasNoTrabajados(Math.min(diasContratados, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-900 rounded-xl border border-slate-700 px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div> {/* cierre del grid de inputs */}

          {/* Listado de Beneficios y Carga Legal */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold tracking-widest uppercase text-slate-400">Matriz de Incidencias Laborales (Base Anual)</span>
              <button
                type="button"
                onClick={resetear}
                className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg text-slate-200 transition-colors"
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
                      ? 'bg-slate-950/60 border-slate-700 shadow-inner'
                      : 'bg-slate-900/20 border-slate-800/60 opacity-40 hover:opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${c.activo ? (metodo === 'indexado' ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-slate-700'}`} />
                    <span className="text-sm text-slate-200">{c.nombre}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{c.dias} días</span>
                </div>
              ))}
            </div>
          </div>

        </div> {/* cierre de p-6 space-y-6 */}
      </div> {/* cierre del modal interior */}
    </div> /* cierre del fixed inset-0 */
  );
}
