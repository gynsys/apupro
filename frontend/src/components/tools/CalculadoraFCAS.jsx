import React, { useState, useMemo, useEffect } from 'react';
import { FolderOpen, Save, Trash2, X, Check, Printer, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================
// CALCULADORA FCAS PROFESIONAL - VENEZUELA
// VERSIÓN CORREGIDA (FÓRMULA ESTÁNDAR)
// ============================================

// Conceptos con días nominales reales (LOTTT + Convención Colectiva estándar)
const CONCEPTOS_DEFAULT = [
  { id: 'utilidades', nombre: 'Utilidades Anuales (Bono Fin de Año)', dias: 90, activo: true },
  { id: 'vacaciones', nombre: 'Vacaciones Básicas (Días de Disfrute)', dias: 15, activo: true },
  { id: 'bono_vac', nombre: 'Bono Vacacional Contractual', dias: 21, activo: true },
  { id: 'prestaciones', nombre: 'Garantía de Prestaciones (LOTTT)', dias: 60, activo: true },
  { id: 'sso', nombre: 'Seguro Social Obligatorio (Patronal 11%)', dias: 40, activo: true },
  { id: 'faov', nombre: 'Fondo de Ahorro Obligatorio (FAOV 2%)', dias: 7, activo: true },
  { id: 'inces', nombre: 'Aporte INCES Patronal (2%)', dias: 7, activo: true },
  { id: 'permisos', nombre: 'Permisos Remunerados / Cláusulas', dias: 15, activo: true },
];

export default function CalculadoraFCAS({ 
  onClose, 
  onUseFCAS, 
  isPage = false,
  initialSalarioBase = 240,
  initialBonoCestaticket = 40,
  initialMetodo = 'estandar',
  savedProfiles = {},
  onSaveProfile = null,
  onDeleteProfile = null
}) {
  // ── Estados ──────────────────────────────────────────────
  const [metodo, setMetodo] = useState(initialMetodo); // 'estandar' o 'indexado'
  const [salarioBase, setSalarioBase] = useState(initialSalarioBase);   // $ mensuales
  const [bonoCestaticket, setBonoCestaticket] = useState(initialBonoCestaticket); // $ mensuales (mínimo legal)
  const [diasContratados, setDiasContratados] = useState(365);
  const [diasNoTrabajados, setDiasNoTrabajados] = useState(114); // se recalcula automáticamente
  const [conceptos, setConceptos] = useState(CONCEPTOS_DEFAULT);
  const [calculoAutomatico, setCalculoAutomatico] = useState(true);

  // ── Modales de Gestión de Cálculos ─────────────────────────
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [profileToDelete, setProfileToDelete] = useState(null);

  // Sincronizar si cambian las props iniciales
  useEffect(() => {
    if (initialSalarioBase) setSalarioBase(initialSalarioBase);
    if (initialBonoCestaticket) setBonoCestaticket(initialBonoCestaticket);
    if (initialMetodo) setMetodo(initialMetodo);
  }, [initialSalarioBase, initialBonoCestaticket, initialMetodo]);

  // ── Cálculo automático de días no laborados ────────────
  const diasDescansoAutomaticos = useMemo(() => {
    if (diasContratados <= 0) return 0;
    // Fines de semana (2 de cada 7 días)
    const finesSemana = diasContratados * (2 / 7);
    // Feriados nacionales (10 al año, proporcionales)
    const feriados = 10 * (diasContratados / 365);
    // Redondeamos hacia arriba
    return Math.ceil(finesSemana + feriados);
  }, [diasContratados]);

  useEffect(() => {
    if (calculoAutomatico) {
      setDiasNoTrabajados(diasDescansoAutomaticos);
    }
  }, [calculoAutomatico, diasDescansoAutomaticos]);

  // ── Cálculo del salario diario ──────────────────────────
  const salarioDiario = useMemo(() => {
    return salarioBase > 0 ? salarioBase / 30 : 0;
  }, [salarioBase]);

  // ── Suma de días de conceptos activos ──────────────────
  const diasPrestaciones = useMemo(() => {
    return conceptos.filter(c => c.activo).reduce((sum, c) => sum + c.dias, 0);
  }, [conceptos]);

  // ── Cálculo del FCAS ────────────────────────────────────
  const fcasPorcentaje = useMemo(() => {
    const diasLaboradosReales = diasContratados - diasNoTrabajados;
    if (diasLaboradosReales <= 0 || salarioDiario <= 0) return 0;

    // Proporción del período evaluado frente al año base
    const factorTemporal = diasContratados / 365;
    const diasPrestacionesProporcionales = diasPrestaciones * factorTemporal;

    let numerador;
    if (metodo === 'estandar') {
      // FÓRMULA ESTÁNDAR: Ti + Días de Prestaciones
      numerador = diasNoTrabajados + diasPrestacionesProporcionales;
    } else {
      // MÉTODO INDEXADO: Ti + Prestaciones + Días equivalentes del Cestaticket
      // Convertir el bono mensual en días equivalentes de salario diario
      const costoBonoPeriodo = (bonoCestaticket / 30) * diasContratados;
      const diasEquivalentesBono = costoBonoPeriodo / salarioDiario;
      numerador = diasNoTrabajados + diasPrestacionesProporcionales + diasEquivalentesBono;
    }

    return (numerador / diasLaboradosReales) * 100;
  }, [metodo, salarioDiario, bonoCestaticket, diasContratados, diasNoTrabajados, diasPrestaciones]);

  // ── Costo real mensual ──────────────────────────────────
  const costoRealMensual = useMemo(() => {
    const factor = 1 + fcasPorcentaje / 100;
    if (metodo === 'estandar') {
      // En el método estándar, el Cestaticket se añade como costo fijo aparte
      return salarioBase * factor + bonoCestaticket;
    } else {
      // En el método indexado, el bono ya está diluido en el FCAS
      return salarioBase * factor;
    }
  }, [salarioBase, fcasPorcentaje, metodo, bonoCestaticket]);

  // ── Handlers ──────────────────────────────────────────────
  const toggleConcepto = (idx) => {
    setConceptos(prev =>
      prev.map((c, i) => (i === idx ? { ...c, activo: !c.activo } : c))
    );
  };

  const resetear = () => setConceptos(CONCEPTOS_DEFAULT.map(c => ({ ...c })));

  const handlePrint = () => window.print();

  const handleConfirmSaveProfile = (e) => {
    if (e) e.preventDefault();
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      toast.error('Por favor ingresa un nombre para el cálculo');
      return;
    }
    const profileData = {
      salarioBase,
      bonoCestaticket,
      metodo,
      diasContratados,
      diasNoTrabajados,
      conceptos,
      fcasPorcentaje: parseFloat(fcasPorcentaje.toFixed(2)),
      costoRealMensual: parseFloat(costoRealMensual.toFixed(2)),
      fecha: new Date().toISOString()
    };
    if (onSaveProfile) {
      onSaveProfile(trimmed, profileData);
    }
    setShowSaveModal(false);
    setNewProfileName('');
  };

  const handleLoadProfile = (name, p) => {
    if (!p) return;
    if (p.salarioBase != null) setSalarioBase(p.salarioBase);
    if (p.bonoCestaticket != null) setBonoCestaticket(p.bonoCestaticket);
    if (p.metodo) setMetodo(p.metodo);
    if (p.diasContratados != null) setDiasContratados(p.diasContratados);
    if (p.diasNoTrabajados != null) {
      setDiasNoTrabajados(p.diasNoTrabajados);
      setCalculoAutomatico(false);
    }
    if (Array.isArray(p.conceptos) && p.conceptos.length > 0) {
      setConceptos(p.conceptos);
    }
    setShowOpenModal(false);
    toast.success(`Cálculo "${name}" cargado exitosamente`);
  };

  const handleDeleteProfile = (name) => {
    if (onDeleteProfile) {
      onDeleteProfile(name);
    }
    setProfileToDelete(null);
  };

  const handleUseFCAS = () => {
    const roundedFCAS = parseFloat(fcasPorcentaje.toFixed(2));
    if (onUseFCAS) {
      onUseFCAS(roundedFCAS, {
        salarioBase,
        bonoCestaticket,
        metodo,
        diasContratados,
        diasNoTrabajados,
        conceptos
      });
    }
  };

  // ── JSX ──────────────────────────────────────────────────
  const containerClasses = isPage
    ? "h-full w-full flex flex-col print:h-auto print:block print:overflow-visible"
    : "fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:static print:h-auto print:block print:overflow-visible";

  const cardClasses = isPage
    ? "bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-5xl mx-auto flex flex-col h-full overflow-hidden border border-slate-200/60 print:border-none print:shadow-none print:overflow-visible print:h-auto print:block"
    : "bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/60 print:border-none print:shadow-none print:max-h-none print:overflow-visible print:h-auto print:block";

  const savedCount = Object.keys(savedProfiles || {}).length;

  return (
    <div className={containerClasses}>
      <div className={cardClasses}>
        
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 print:bg-white print:shadow-none">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">
              Calculadora de Costos de Construcción (FCAS)
            </h1>
            <p className="text-xs text-slate-500 mt-1">Factor de Costos Asociados al Salario según LOTTT y Convención Colectiva</p>
          </div>
          
          <div className="flex items-center flex-wrap gap-2 print:hidden">
            {/* Botón Abrir Cálculo */}
            <button
              type="button"
              onClick={() => setShowOpenModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-lg transition-colors border border-sky-200 shadow-sm"
              title="Abrir un cálculo guardado"
            >
              <FolderOpen size={15} />
              <span>Abrir Cálculo</span>
              {savedCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-sky-600 text-white text-[10px] font-bold rounded-full leading-none">
                  {savedCount}
                </span>
              )}
            </button>

            {/* Botón Guardar Como */}
            <button
              type="button"
              onClick={() => {
                setNewProfileName('');
                setShowSaveModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors border border-blue-200 shadow-sm"
              title="Guardar cálculo actual con un nombre"
            >
              <Save size={15} />
              <span>Guardar Como</span>
            </button>

            {/* Restaurar valores si hubo modificaciones */}
            {(salarioBase !== initialSalarioBase || bonoCestaticket !== initialBonoCestaticket || metodo !== initialMetodo) && (
              <button
                type="button"
                onClick={() => {
                  setSalarioBase(initialSalarioBase);
                  setBonoCestaticket(initialBonoCestaticket);
                  setMetodo(initialMetodo);
                  setConceptos(CONCEPTOS_DEFAULT.map(c => ({ ...c })));
                  setCalculoAutomatico(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors border border-slate-300"
                title="Restaurar a valores predeterminados"
              >
                <RotateCcw size={14} />
                <span>Restaurar</span>
              </button>
            )}

            {/* Botón Usar FCAS (Predeterminado para Nuevos Presupuestos) */}
            <button
              type="button"
              onClick={handleUseFCAS}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              title="Establece este porcentaje como el FCAS predeterminado en tu cuenta para futuros presupuestos"
            >
              <Check size={15} />
              <span>Usar FCAS</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900 border border-slate-200"
              title="Imprimir cálculo"
            >
              <Printer size={16} />
            </button>

            {!isPage && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 border border-slate-200"
                title="Cerrar ventana"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-2 pb-8 space-y-5 print:p-4 print:overflow-visible">
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
              Método con Cestaticket en FCAS
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
                  ? '⚠️ El Cestaticket se convierte en días equivalentes y se integra al FCAS.'
                  : '📋 Método Estándar: El Cestaticket va al APU, no infla el FCAS.'}
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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cestaticket Mensual (USD)</label>
              <input
                type="number"
                value={bonoCestaticket}
                onChange={(e) => setBonoCestaticket(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {metodo === 'estandar' && (
                <p className="text-[10px] text-slate-400">Se añade como costo fijo al APU</p>
              )}
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
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Días No Laborados (Ti)</label>
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
              <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
                Matriz de Beneficios y Prestaciones (Días nominales anuales)
              </span>
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

      {/* MODAL ABRIR CÁLCULO */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
                  <FolderOpen size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Cálculos de FCAS Guardados</h3>
                  <p className="text-xs text-slate-500">
                    {savedCount} {savedCount === 1 ? 'cálculo guardado' : 'cálculos guardados'} en tu cuenta
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOpenModal(false);
                  setProfileToDelete(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {savedCount === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-16 h-16 bg-sky-50 text-sky-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-sky-100">
                    <FolderOpen size={32} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">Aún no tienes cálculos guardados</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    Configura los parámetros laborales que necesites y haz clic en <strong className="text-slate-700">"Guardar Como"</strong> para registrar cálculos para obras específicas, licitaciones públicas o convenios privados.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOpenModal(false);
                      setShowSaveModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                  >
                    <Save size={14} /> Guardar cálculo actual
                  </button>
                </div>
              ) : (
                Object.entries(savedProfiles).map(([name, data]) => {
                  const isDeleting = profileToDelete === name;
                  const fcasVal = data.fcasPorcentaje != null ? data.fcasPorcentaje : null;
                  const metodoLabel = data.metodo === 'indexado' ? 'Indexado con Cestaticket' : 'Estándar LOTTT';
                  const fechaStr = data.fecha 
                    ? new Date(data.fecha).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : null;

                  return (
                    <div
                      key={name}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-800 truncate" title={name}>
                            {name}
                          </h4>
                          {fcasVal != null && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              FCAS {fcasVal}%
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {metodoLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span>Base: <strong className="text-slate-700">${data.salarioBase || 0}</strong></span>
                          <span>•</span>
                          <span>Cestaticket: <strong className="text-slate-700">${data.bonoCestaticket || 0}</strong></span>
                          {data.diasContratados && (
                            <>
                              <span>•</span>
                              <span>{data.diasContratados} días ({data.diasNoTrabajados || 114} Ti)</span>
                            </>
                          )}
                          {fechaStr && (
                            <>
                              <span>•</span>
                              <span className="text-slate-400">{fechaStr}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {isDeleting ? (
                          <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                            <span className="text-[11px] font-semibold text-red-700 px-1">¿Eliminar?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteProfile(name)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded"
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setProfileToDelete(null)}
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleLoadProfile(name, data)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                            >
                              <FolderOpen size={14} />
                              <span>Cargar</span>
                            </button>
                            {onDeleteProfile && (
                              <button
                                type="button"
                                onClick={() => setProfileToDelete(name)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar este cálculo"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowOpenModal(false);
                  setProfileToDelete(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GUARDAR CÁLCULO COMO */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Save size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Guardar Cálculo de FCAS</h3>
                  <p className="text-xs text-slate-500">Guarda este análisis para reutilizarlo cuando quieras</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmSaveProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Cálculo / Perfil
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Ej: Licitación Gobernación 2026, Privado..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>

              {/* Resumen de lo que se guardará */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Resumen del Análisis a Guardar
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">FCAS Resultante:</span>
                    <p className="font-bold text-blue-600 text-sm">{fcasPorcentaje.toFixed(2)}%</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Costo Mensual Real:</span>
                    <p className="font-bold text-slate-800 text-sm">${costoRealMensual.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Método:</span>
                    <p className="font-semibold text-slate-700 capitalize">{metodo}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Salario / Bono:</span>
                    <p className="font-semibold text-slate-700">${salarioBase} / ${bonoCestaticket}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newProfileName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  <Save size={14} />
                  <span>Guardar Cálculo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}