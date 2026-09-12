import React, { useState, useMemo, useEffect } from 'react';
import { FolderOpen, Save, Trash2, X, Check, Printer, RotateCcw, Pencil, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import DecimalInput from '../DecimalInput';

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

  // ── Alícuota de Salario Integral (LOTTT Art. 122) ─────────
  // Para la garantía de prestaciones (Art. 142 LOTTT), el salario integral
  // incluye la alícuota de utilidades y de bono vacacional:
  const diasUtilidades = useMemo(() => {
    return conceptos.find(c => c.id === 'utilidades')?.activo 
      ? (conceptos.find(c => c.id === 'utilidades')?.dias || 0) 
      : 0;
  }, [conceptos]);

  const diasBonoVac = useMemo(() => {
    return conceptos.find(c => c.id === 'bono_vac')?.activo 
      ? (conceptos.find(c => c.id === 'bono_vac')?.dias || 0) 
      : 0;
  }, [conceptos]);

  const alicuotaSalarioIntegral = useMemo(() => {
    // Alícuota = 1 + (Días Utilidades + Días Bono Vacacional) / 360
    return 1 + (diasUtilidades + diasBonoVac) / 360;
  }, [diasUtilidades, diasBonoVac]);

  // ── Ausencias remuneradas disfrutadas fuera de obra (Vacaciones disfrute + Permisos) ──
  const diasAusenciasObra = useMemo(() => {
    const factorTemporal = diasContratados > 0 ? diasContratados / 365 : 1;
    const vac = conceptos.find(c => c.id === 'vacaciones')?.activo ? (conceptos.find(c => c.id === 'vacaciones')?.dias || 0) : 0;
    const perm = conceptos.find(c => c.id === 'permisos')?.activo ? (conceptos.find(c => c.id === 'permisos')?.dias || 0) : 0;
    return Math.round((vac + perm) * factorTemporal);
  }, [conceptos, diasContratados]);

  // Total de días no laborados en obra (Descansos semanales/feriados Ti + Ausencias por vacaciones/permisos)
  const totalDiasNoTrabajados = useMemo(() => {
    return diasNoTrabajados + diasAusenciasObra;
  }, [diasNoTrabajados, diasAusenciasObra]);

  // Días Efectivamente Laborados en Obra (DEL)
  const diasLaboradosReales = useMemo(() => {
    return Math.max(1, diasContratados - totalDiasNoTrabajados);
  }, [diasContratados, totalDiasNoTrabajados]);

  // ── Días equivalentes de conceptos de beneficios y pasivos ──
  const { diasPrestacionesEquivalentes, diasPasivosAdicionales } = useMemo(() => {
    let prestEq = 0;
    let pasivosAdicionales = 0;

    conceptos.forEach(c => {
      if (!c.activo) return;
      if (c.id === 'prestaciones') {
        const eq = c.dias * alicuotaSalarioIntegral;
        prestEq += eq;
        pasivosAdicionales += eq;
      } else if (c.id === 'vacaciones' || c.id === 'permisos') {
        // Ausencias remuneradas: ya cubiertas en el salario base ordinario
        prestEq += c.dias;
      } else {
        // Utilidades, Bono Vacacional, SSO, FAOV, INCES: pasivos y aportes adicionales
        prestEq += c.dias;
        pasivosAdicionales += c.dias;
      }
    });

    return { diasPrestacionesEquivalentes: prestEq, diasPasivosAdicionales: pasivosAdicionales };
  }, [conceptos, alicuotaSalarioIntegral]);

  // Proporción del período evaluado frente al año base
  const factorTemporal = useMemo(() => {
    return diasContratados > 0 ? diasContratados / 365 : 1;
  }, [diasContratados]);

  const diasPrestacionesProporcionales = useMemo(() => {
    return diasPrestacionesEquivalentes * factorTemporal;
  }, [diasPrestacionesEquivalentes, factorTemporal]);

  // Días equivalentes del Cestaticket frente al salario base (exclusivo para método indexado)
  const diasEquivalentesBono = useMemo(() => {
    if (metodo !== 'indexado' || salarioBase <= 0 || bonoCestaticket <= 0) return 0;
    const salarioDiarioRef = salarioBase / 30;
    const costoBonoPeriodo = (bonoCestaticket / 30) * diasContratados;
    return costoBonoPeriodo / salarioDiarioRef;
  }, [metodo, salarioBase, bonoCestaticket, diasContratados]);

  // ── Cálculo del FCAS (%) ────────────────────────────────────
  const fcasPorcentaje = useMemo(() => {
    if (diasLaboradosReales <= 0) return 0;

    let numerador;
    if (metodo === 'estandar') {
      // MÉTODO ESTÁNDAR: Ti + Todos los beneficios/prestaciones equivalentes
      // No depende de salarios monetarios, solo de días de ley vs días laborados
      numerador = diasNoTrabajados + diasPrestacionesProporcionales;
    } else {
      // MÉTODO INDEXADO: Ti + Prestaciones + Días equivalentes del Cestaticket
      numerador = diasNoTrabajados + diasPrestacionesProporcionales + diasEquivalentesBono;
    }

    return (numerador / diasLaboradosReales) * 100;
  }, [metodo, diasLaboradosReales, diasNoTrabajados, diasPrestacionesProporcionales, diasEquivalentesBono]);

  // ── Costo real mensual de mano de obra (para persistencia/perfiles) ──────
  const { costoRealMensual, costoJornalObra } = useMemo(() => {
    if (salarioBase <= 0) return { costoRealMensual: 0, costoJornalObra: 0 };

    const mesesPeriodo = diasContratados > 0 ? diasContratados / 30 : 12;

    // Pasivos y aportes patronales adicionales al salario mensual ordinario
    const costoPasivosPeriodo = diasPasivosAdicionales * salarioDiario * factorTemporal;
    const provisionMensualPasivos = mesesPeriodo > 0 ? costoPasivosPeriodo / mesesPeriodo : 0;

    // Costo mensual real contable: Salario Base + Provisión de Pasivos + Cestaticket
    const totalMensual = salarioBase + provisionMensualPasivos + (bonoCestaticket || 0);

    // Costo diario efectivo en obra (Jornal con FCAS aplicable en APU)
    let jornalObra = salarioDiario * (1 + fcasPorcentaje / 100);
    if (metodo === 'estandar') {
      const bonoDiarioObra = diasLaboradosReales > 0 
        ? ((bonoCestaticket / 30) * diasContratados) / diasLaboradosReales 
        : 0;
      jornalObra += bonoDiarioObra;
    }

    return { 
      costoRealMensual: totalMensual, 
      costoJornalObra: jornalObra 
    };
  }, [salarioBase, salarioDiario, diasPasivosAdicionales, factorTemporal, diasContratados, bonoCestaticket, fcasPorcentaje, metodo, diasLaboradosReales]);

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
          <div className="flex justify-center items-center gap-5">
            <button
              type="button"
              onClick={() => setMetodo('estandar')}
              className={`px-4 py-2 text-xs font-bold rounded-xl border-2 transition-all ${
                metodo === 'estandar'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-800 border-slate-300 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              Método Estándar LOTTT
            </button>
            <button
              type="button"
              onClick={() => setMetodo('indexado')}
              className={`px-4 py-2 text-xs font-bold rounded-xl border-2 transition-all ${
                metodo === 'indexado'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-slate-800 border-slate-300 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              Método con Cestaticket en FCAS
            </button>
          </div>

          {/* Indicador Principal */}
          <div className="rounded-2xl p-5 bg-white border-2 border-slate-300 shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-xs font-black tracking-widest uppercase text-slate-800">Factor F.C.A.S. Calculado</span>
            <div className="mt-1 flex items-baseline justify-center gap-2">
              <span className={`text-4xl font-black ${metodo === 'indexado' ? 'text-emerald-600' : 'text-blue-600'}`}>
                {fcasPorcentaje.toFixed(2)}%
              </span>
              <span className="text-xs text-slate-700 font-bold">sobre el jornal básico</span>
            </div>
          </div>

          {/* Inputs de Control */}
          {metodo === 'estandar' ? (
            /* Método Estándar: Solo requiere los días de calendario (N) y días no laborados (Ti) */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border-2 border-slate-300 shadow-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">Días Ejecución del Contrato (N)</label>
                <DecimalInput
                  value={diasContratados}
                  onChange={(val) => setDiasContratados(Math.max(1, val))}
                  className="w-full bg-slate-50 rounded-xl border-2 border-slate-300 px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600"
                />
                <p className="text-xs text-slate-600 font-medium">Días de calendario evaluados (Base estándar: 365 días)</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider">Días No Laborados de Calendario (Ti)</label>
                  <button
                    type="button"
                    onClick={() => setCalculoAutomatico(!calculoAutomatico)}
                    className={`text-[11px] px-2.5 py-0.5 rounded-lg transition-colors font-bold inline-flex items-center gap-1.5 ${
                      calculoAutomatico ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-800 border border-slate-300'
                    }`}
                  >
                    {calculoAutomatico ? (
                      <>
                        <Lock size={12} className="shrink-0" />
                        <span>Auto (Fines de semana + Feriados)</span>
                      </>
                    ) : (
                      <>
                        <Pencil size={12} className="shrink-0" />
                        <span>Manual</span>
                      </>
                    )}
                  </button>
                </div>
                <DecimalInput
                  value={diasNoTrabajados}
                  onChange={(val) => {
                    setCalculoAutomatico(false);
                    setDiasNoTrabajados(Math.min(diasContratados, val));
                  }}
                  className={`w-full rounded-xl border-2 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-1 ${
                    calculoAutomatico 
                      ? 'border-emerald-400 bg-emerald-50/60 text-emerald-900 focus:ring-emerald-500' 
                      : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-600 focus:bg-white'
                  }`}
                />
                <p className="text-xs text-slate-600 font-medium">
                  {calculoAutomatico ? 'Calculado automáticamente (52 semanas + 10 feriados nacionales)' : 'Ajuste manual para obras con condiciones climáticas particulares'}
                </p>
              </div>
            </div>
          ) : (
            /* Método Indexado: Requiere N, Ti, y el salario/bono para indexar el Cestaticket a días */
            <div className="space-y-2 bg-white p-5 rounded-2xl border-2 border-slate-300 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider">Días Ejecución (N)</label>
                  <DecimalInput
                    value={diasContratados}
                    onChange={(val) => setDiasContratados(Math.max(1, val))}
                    className="w-full bg-slate-50 rounded-xl border-2 border-slate-300 px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider">Días No Laborados (Ti)</label>
                    <button
                      type="button"
                      onClick={() => setCalculoAutomatico(!calculoAutomatico)}
                      className={`text-[11px] px-2.5 py-0.5 rounded-lg transition-colors font-bold inline-flex items-center gap-1.5 ${
                        calculoAutomatico ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-800 border border-slate-300'
                      }`}
                    >
                      {calculoAutomatico ? (
                        <>
                          <Lock size={12} className="shrink-0" />
                          <span>Auto</span>
                        </>
                      ) : (
                        <>
                          <Pencil size={12} className="shrink-0" />
                          <span>Manual</span>
                        </>
                      )}
                    </button>
                  </div>
                  <DecimalInput
                    value={diasNoTrabajados}
                    onChange={(val) => {
                      setCalculoAutomatico(false);
                      setDiasNoTrabajados(Math.min(diasContratados, val));
                    }}
                    className="w-full bg-slate-50 rounded-xl border-2 border-slate-300 px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-emerald-800 uppercase tracking-wider">Salario Base Ref. (USD/mes)</label>
                  <DecimalInput
                    value={salarioBase}
                    onChange={(val) => setSalarioBase(Math.max(0, val))}
                    className="w-full bg-slate-50 rounded-xl border-2 border-emerald-300 px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600"
                  />
                  <p className="text-xs text-emerald-800 font-semibold">Para calcular el salario diario</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-emerald-800 uppercase tracking-wider">Cestaticket (USD/mes)</label>
                  <DecimalInput
                    value={bonoCestaticket}
                    onChange={(val) => setBonoCestaticket(Math.max(0, val))}
                    className="w-full bg-slate-50 rounded-xl border-2 border-emerald-300 px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600"
                  />
                  <p className="text-xs text-emerald-800 font-semibold">Equivale a {diasEquivalentesBono.toFixed(1)} días de salario</p>
                </div>
              </div>
            </div>
          )}

          {/* Matriz de Incidencias */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black tracking-widest uppercase text-slate-800">
                Matriz de Beneficios y Prestaciones (Días nominales anuales)
              </span>
              <button
                type="button"
                onClick={resetear}
                className="text-xs bg-slate-200 hover:bg-slate-300 font-bold px-3 py-1 rounded-lg text-slate-800 transition-colors border border-slate-300 print:hidden"
              >
                Resetear Matriz
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {conceptos.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => toggleConcepto(idx)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                    c.activo
                      ? 'bg-white border-slate-300 shadow-sm hover:border-amber-400 hover:shadow-md'
                      : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${c.activo ? (metodo === 'indexado' ? 'bg-emerald-600 ring-2 ring-emerald-200' : 'bg-blue-600 ring-2 ring-blue-200') : 'bg-slate-400'}`} />
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-slate-900 block truncate">{c.nombre}</span>
                      {c.id === 'prestaciones' && c.activo && alicuotaSalarioIntegral > 1 && (
                        <span className="text-[11px] text-blue-700 font-bold block">
                          Equiv. {(c.dias * alicuotaSalarioIntegral).toFixed(1)} días con Salario Integral (Art. 122 LOTTT)
                        </span>
                      )}
                      {(c.id === 'vacaciones' || c.id === 'permisos') && c.activo && (
                        <span className="text-[11px] text-amber-700 font-bold block">
                          Ausencia remunerada (se deduce de días en obra)
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-800 shrink-0 ml-3">{c.dias} días</span>
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
                    <span className="text-slate-500">Multiplicador (1+FCAS):</span>
                    <p className="font-bold text-slate-800 text-sm">{(1 + fcasPorcentaje / 100).toFixed(4)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Método:</span>
                    <p className="font-semibold text-slate-700">{metodo === 'indexado' ? 'Con Bono en FCAS' : 'Estándar LOTTT'}</p>
                  </div>
                  <div>
                    {metodo === 'indexado' ? (
                      <>
                        <span className="text-slate-500">Salario / Bono Ref:</span>
                        <p className="font-semibold text-slate-700">${salarioBase} / ${bonoCestaticket}</p>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-500">Días en Obra (DEL):</span>
                        <p className="font-semibold text-slate-700">{diasLaboradosReales} días</p>
                      </>
                    )}
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