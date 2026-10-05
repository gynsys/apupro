import React, { useState, useMemo, useEffect } from 'react';
import { 
  FolderOpen, 
  Save, 
  Trash2, 
  X, 
  Check, 
  Printer, 
  RotateCcw, 
  Pencil, 
  Lock, 
  Info, 
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  Truck,
  HardHat,
  HeartPulse,
  DollarSign,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import DecimalInput from '../DecimalInput';

// =========================================================================
// CALCULADORA UNIFICADA DE COSTOS ASOCIADOS AL SALARIO (FCAS)
// Matriz Dinámica Basada en la Fórmula Expandida Anual (Base 365 Días)
// Conforme a la LOTTT, Convención Colectiva Única y CostBase
// =========================================================================

// Conceptos de Ley de la Matriz Expandida (LOTTT + CCU)
const CONCEPTOS_DEFAULT = [
  { id: 'utilidades', nombre: 'Utilidades Contractuales (Bono Fin de Año)', dias: 90, activo: true, info: 'Art. 131 LOTTT / Convención Colectiva' },
  { id: 'bono_vac', nombre: 'Bono Vacacional Contractual', dias: 21, activo: true, info: 'Art. 192 LOTTT / Cláusula 45 CCU' },
  { id: 'prestaciones', nombre: 'Garantía de Prestaciones (LOTTT Art. 142)', dias: 60, activo: true, info: 'Recalculado con Alícuota Salario Integral (Art. 122 LOTTT)' },
  { id: 'sso', nombre: 'Seguro Social Obligatorio (IVSS Patronal 11%)', dias: 40, activo: true, info: '11% sobre nómina anual regular' },
  { id: 'inces', nombre: 'Aporte INCES Patronal (2%)', dias: 7, activo: true, info: '2% sobre remuneraciones brutas anuales' },
  { id: 'faov', nombre: 'Fondo de Ahorro Vivienda (FAOV 2%)', dias: 7, activo: true, info: '2% aporte patronal obligatorio de ley' },
];

export default function CalculadoraFCAS({ 
  onClose, 
  onUseFCAS, 
  isPage = false,
  initialSalarioBase = 80,
  initialBonoCestaticket = 174,
  initialBonoInFcas = false,
  initialDiasRendimiento = 56,
  initialCostoHcm = 450,
  initialCostoTransporte = 547.5,
  initialCostoEpp = 290,
  initialActivoHcm = true,
  initialActivoTransporte = true,
  initialActivoEpp = true,
  initialMetodo = 'estandar',
  savedProfiles = {},
  onSaveProfile = null,
  onDeleteProfile = null
}) {
  // ── 1. Parámetros Económicos Maestros (100% Editables) ───────────────────
  const [salarioBase, setSalarioBase] = useState(initialSalarioBase || 80); // $ mensuales
  const [salarioDiario, setSalarioDiario] = useState(
    Number(((initialSalarioBase || 80) / 30).toFixed(2))
  ); // $ diario (Sb) redondeado a 2 decimales
  const [bonoCestaticket, setBonoCestaticket] = useState(initialBonoCestaticket || 174); // $ mensuales
  const [bonoInFcas, setBonoInFcas] = useState(
    initialBonoInFcas != null 
      ? Boolean(initialBonoInFcas) 
      : (initialMetodo === 'indexado')
  );

  // ── 2. Denominador: Días de Obra y Pérdidas de Jornada ───────────────────
  const [diasContratados, setDiasContratados] = useState(365); // N (días calendario base)
  const [diasNoTrabajados, setDiasNoTrabajados] = useState(115); // Ti (descansos y feriados)
  const [calculoAutomatico, setCalculoAutomatico] = useState(true);
  const [diasVacaciones, setDiasVacaciones] = useState(15); // Disfrute efectivo de descanso
  const [diasPermisos, setDiasPermisos] = useState(15); // Permisos y contingencias de contrato
  const [diasRendimiento, setDiasRendimiento] = useState(initialDiasRendimiento ?? 56); // Pérdida por lluvias/rendimiento

  // ── 3. Compensaciones Comerciales y Operación de Campo en USD ───────────
  const [costoHcm, setCostoHcm] = useState(initialCostoHcm ?? 450); // $ anual póliza gremial
  const [costoTransporte, setCostoTransporte] = useState(initialCostoTransporte ?? 547.5); // $ anual ruta obligatoria
  const [costoEpp, setCostoEpp] = useState(initialCostoEpp ?? 290); // $ anual uniformes y botas
  const [activoHcm, setActivoHcm] = useState(initialActivoHcm ?? true);
  const [activoTransporte, setActivoTransporte] = useState(initialActivoTransporte ?? true);
  const [activoEpp, setActivoEpp] = useState(initialActivoEpp ?? true);

  // ── 4. Matriz de Conceptos de Ley ────────────────────────────────────────
  const [conceptos, setConceptos] = useState(CONCEPTOS_DEFAULT);

  // ── 5. Modales de Perfiles ───────────────────────────────────────────────
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [profileToDelete, setProfileToDelete] = useState(null);

  // Sincronizar props iniciales si cambian
  useEffect(() => {
    if (initialSalarioBase != null) {
      setSalarioBase(initialSalarioBase);
      setSalarioDiario(Number((initialSalarioBase / 30).toFixed(2)));
    }
    if (initialBonoCestaticket != null) setBonoCestaticket(initialBonoCestaticket);
    if (initialBonoInFcas != null) {
      setBonoInFcas(Boolean(initialBonoInFcas));
    } else if (initialMetodo) {
      setBonoInFcas(initialMetodo === 'indexado');
    }
    if (initialActivoHcm != null) setActivoHcm(Boolean(initialActivoHcm));
    if (initialActivoTransporte != null) setActivoTransporte(Boolean(initialActivoTransporte));
    if (initialActivoEpp != null) setActivoEpp(Boolean(initialActivoEpp));
  }, [initialSalarioBase, initialBonoCestaticket, initialBonoInFcas, initialMetodo, initialActivoHcm, initialActivoTransporte, initialActivoEpp]);

  // Manejar cambio bidireccional entre Sueldo Mensual y Salario Básico Diario
  const handleSalarioBaseChange = (val) => {
    const sMensual = Math.max(0, val);
    setSalarioBase(sMensual);
    setSalarioDiario(sMensual > 0 ? Number((sMensual / 30).toFixed(2)) : 0);
  };

  const handleSalarioDiarioChange = (val) => {
    const sDiario = Math.max(0, Number(Number(val).toFixed(2)));
    setSalarioDiario(sDiario);
    setSalarioBase(Number((sDiario * 30).toFixed(2)));
  };

  // Cálculo automático de días de descanso (Ti)
  const diasDescansoAutomaticos = useMemo(() => {
    if (diasContratados <= 0) return 0;
    const finesSemana = diasContratados * (2 / 7);
    const feriados = 11 * (diasContratados / 365);
    return Math.ceil(finesSemana + feriados);
  }, [diasContratados]);

  useEffect(() => {
    if (calculoAutomatico) {
      setDiasNoTrabajados(diasDescansoAutomaticos);
    }
  }, [calculoAutomatico, diasDescansoAutomaticos]);

  // Factor de proporción temporal frente al año estándar
  const factorTemporal = useMemo(() => {
    return diasContratados > 0 ? diasContratados / 365 : 1;
  }, [diasContratados]);

  // ── CÁLCULO DEL DENOMINADOR: Días Efectivamente Laborados (DT) ───────────
  const dtLaborados = useMemo(() => {
    const tiDeduccion = (diasNoTrabajados || 0) * factorTemporal;
    const vacDeduccion = (diasVacaciones || 0) * factorTemporal;
    const permDeduccion = (diasPermisos || 0) * factorTemporal;
    const rendDeduccion = (diasRendimiento || 0) * factorTemporal;
    const totalDeducciones = tiDeduccion + vacDeduccion + permDeduccion + rendDeduccion;
    return Math.max(1, Math.round(diasContratados - totalDeducciones));
  }, [diasContratados, diasNoTrabajados, diasVacaciones, diasPermisos, diasRendimiento, factorTemporal]);

  // ── ALÍCUOTA DE SALARIO INTEGRAL (Art. 122 LOTTT) ─────────────────────────
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
    return 1 + (diasUtilidades + diasBonoVac) / 360;
  }, [diasUtilidades, diasBonoVac]);

  // ── CÁLCULO DEL NUMERADOR: Matriz Expandida de Días Pagados (DP) ─────────
  // A. Días Base del Año Calendario Evaluado
  const diasBaseNomina = diasContratados;

  // B. Días de Beneficios y Pasivos Legales
  const diasBeneficiosLegales = useMemo(() => {
    let sum = 0;
    conceptos.forEach(c => {
      if (!c.activo) return;
      if (c.id === 'prestaciones') {
        sum += (c.dias * alicuotaSalarioIntegral) * factorTemporal;
      } else {
        sum += c.dias * factorTemporal;
      }
    });
    return sum;
  }, [conceptos, alicuotaSalarioIntegral, factorTemporal]);

  // C. Días Equivalentes Comerciales y de Operación de Campo en USD
  const { diasHcm, diasTransporte, diasEpp, dpCampoTotal } = useMemo(() => {
    const sDia = salarioDiario > 0 ? salarioDiario : (salarioBase > 0 ? Number((salarioBase / 30).toFixed(2)) : 2.67);
    const dHcm = (activoHcm && sDia > 0) ? (costoHcm * factorTemporal) / sDia : 0;
    const dTransp = (activoTransporte && sDia > 0) ? (costoTransporte * factorTemporal) / sDia : 0;
    const dEpp = (activoEpp && sDia > 0) ? costoEpp / sDia : 0; // Fijo inmutable ante obras cortas

    return {
      diasHcm: dHcm,
      diasTransporte: dTransp,
      diasEpp: dEpp,
      dpCampoTotal: dHcm + dTransp + dEpp
    };
  }, [salarioDiario, salarioBase, costoHcm, costoTransporte, costoEpp, factorTemporal, activoHcm, activoTransporte, activoEpp]);

  // Días que aporta el bono si se absorbe en el FCAS
  const diasBonoPotenciales = useMemo(() => {
    const sDia = salarioDiario > 0 ? salarioDiario : (salarioBase > 0 ? Number((salarioBase / 30).toFixed(2)) : 2.67);
    return sDia > 0 ? (bonoCestaticket * 12 * factorTemporal) / sDia : 0;
  }, [salarioDiario, salarioBase, bonoCestaticket, factorTemporal]);

  // DP sin bono (Base + Ley + Campo ordinario)
  const dpSinBono = useMemo(() => {
    return diasBaseNomina + diasBeneficiosLegales + dpCampoTotal;
  }, [diasBaseNomina, diasBeneficiosLegales, dpCampoTotal]);

  // DP con bono integrado
  const dpConBono = useMemo(() => {
    return dpSinBono + diasBonoPotenciales;
  }, [dpSinBono, diasBonoPotenciales]);

  // Total Días Pagados y Equivalentes según opción activa
  const dpTotal = useMemo(() => {
    return bonoInFcas ? dpConBono : dpSinBono;
  }, [bonoInFcas, dpConBono, dpSinBono]);

  // FCAS puro de Ley y Campo (sin bono Cestaticket)
  const fcasPuro = useMemo(() => {
    if (dtLaborados <= 0) return 0;
    return Math.max(0, ((dpSinBono / dtLaborados) - 1) * 100);
  }, [dtLaborados, dpSinBono]);

  // FCAS con bono integrado
  const fcasConBono = useMemo(() => {
    if (dtLaborados <= 0) return 0;
    return Math.max(0, ((dpConBono / dtLaborados) - 1) * 100);
  }, [dtLaborados, dpConBono]);

  // FCAS resultante según opción activa (%)
  const fcasPorcentaje = useMemo(() => {
    return bonoInFcas ? fcasConBono : fcasPuro;
  }, [bonoInFcas, fcasConBono, fcasPuro]);

  // Multiplicador sobre el Jornal Básico (1 + FCAS/100)
  const fcasMultiplicador = useMemo(() => {
    return 1 + (fcasPorcentaje / 100);
  }, [fcasPorcentaje]);

  // Bono Diario Lineal para el APU (cuando bonoInFcas === false)
  const bonoDiarioApu = useMemo(() => {
    return diasContratados > 0 ? (bonoCestaticket * 12) / diasContratados : (bonoCestaticket / 30);
  }, [bonoCestaticket, diasContratados]);

  // Costo diario efectivo en obra de un oficial (Jornal con FCAS aplicable en APU)
  const costoJornalObra = useMemo(() => {
    const jornalConFcas = salarioDiario * fcasMultiplicador;
    return bonoInFcas ? jornalConFcas : (jornalConFcas + bonoDiarioApu);
  }, [salarioDiario, fcasMultiplicador, bonoInFcas, bonoDiarioApu]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const todosCampoActivos = Boolean(activoHcm && activoTransporte && activoEpp);
  const algunoCampoActivo = Boolean(activoHcm || activoTransporte || activoEpp);

  const handleToggleTodosCampo = () => {
    const nuevoEstado = !algunoCampoActivo;
    setActivoHcm(nuevoEstado);
    setActivoTransporte(nuevoEstado);
    setActivoEpp(nuevoEstado);
  };

  const toggleConcepto = (idx) => {
    setConceptos(prev =>
      prev.map((c, i) => (i === idx ? { ...c, activo: !c.activo } : c))
    );
  };

  const handleConceptoDiasChange = (idx, dias) => {
    setConceptos(prev =>
      prev.map((c, i) => (i === idx ? { ...c, dias: Math.max(0, dias) } : c))
    );
  };

  const resetearValores = () => {
    setSalarioBase(initialSalarioBase || 80);
    setSalarioDiario(Number(((initialSalarioBase || 80) / 30).toFixed(2)));
    setBonoCestaticket(initialBonoCestaticket || 174);
    setBonoInFcas(false);
    setDiasContratados(365);
    setDiasNoTrabajados(115);
    setCalculoAutomatico(true);
    setDiasVacaciones(15);
    setDiasPermisos(15);
    setDiasRendimiento(initialDiasRendimiento ?? 56);
    setCostoHcm(initialCostoHcm ?? 450);
    setCostoTransporte(initialCostoTransporte ?? 547.5);
    setCostoEpp(initialCostoEpp ?? 290);
    setActivoHcm(true);
    setActivoTransporte(true);
    setActivoEpp(true);
    setConceptos(CONCEPTOS_DEFAULT.map(c => ({ ...c })));
    toast.success('Valores de la matriz restaurados a configuración base');
  };

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
      salarioDiario: parseFloat(salarioDiario.toFixed(2)),
      bonoCestaticket,
      bonoInFcas,
      diasContratados,
      diasNoTrabajados,
      calculoAutomatico,
      diasVacaciones,
      diasPermisos,
      diasRendimiento,
      costoHcm,
      costoTransporte,
      costoEpp,
      activoHcm,
      activoTransporte,
      activoEpp,
      conceptos,
      fcasPorcentaje: parseFloat(fcasPorcentaje.toFixed(2)),
      bonoDiario: parseFloat(bonoDiarioApu.toFixed(4)),
      costoJornalObra: parseFloat(costoJornalObra.toFixed(2)),
      metodo: bonoInFcas ? 'indexado' : 'estandar',
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
    if (p.salarioDiario != null) {
      setSalarioDiario(Number(Number(p.salarioDiario).toFixed(2)));
    } else if (p.salarioBase != null) {
      setSalarioDiario(Number((p.salarioBase / 30).toFixed(2)));
    }
    if (p.bonoCestaticket != null) setBonoCestaticket(p.bonoCestaticket);
    if (p.bonoInFcas != null) {
      setBonoInFcas(Boolean(p.bonoInFcas));
    } else if (p.metodo != null) {
      setBonoInFcas(p.metodo === 'indexado');
    }
    if (p.diasContratados != null) setDiasContratados(p.diasContratados);
    if (p.diasNoTrabajados != null) {
      setDiasNoTrabajados(p.diasNoTrabajados);
      setCalculoAutomatico(false);
    }
    if (p.calculoAutomatico != null) setCalculoAutomatico(p.calculoAutomatico);
    if (p.diasVacaciones != null) setDiasVacaciones(p.diasVacaciones);
    if (p.diasPermisos != null) setDiasPermisos(p.diasPermisos);
    if (p.diasRendimiento != null) setDiasRendimiento(p.diasRendimiento);
    if (p.costoHcm != null) setCostoHcm(p.costoHcm);
    if (p.costoTransporte != null) setCostoTransporte(p.costoTransporte);
    if (p.costoEpp != null) setCostoEpp(p.costoEpp);
    if (p.activoHcm != null) setActivoHcm(Boolean(p.activoHcm));
    if (p.activoTransporte != null) setActivoTransporte(Boolean(p.activoTransporte));
    if (p.activoEpp != null) setActivoEpp(Boolean(p.activoEpp));
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

  const handleUseFCAS = (targetBonoInFcas) => {
    const isEnFcas = typeof targetBonoInFcas === 'boolean' ? targetBonoInFcas : Boolean(bonoInFcas);
    setBonoInFcas(isEnFcas);
    const targetFcas = isEnFcas ? fcasConBono : fcasPuro;
    const roundedFCAS = parseFloat(targetFcas.toFixed(2));
    if (onUseFCAS) {
      onUseFCAS(roundedFCAS, {
        salarioBase,
        salarioDiario: parseFloat(salarioDiario.toFixed(2)),
        bonoCestaticket,
        bonoInFcas: isEnFcas,
        bonoDiario: isEnFcas ? 0.0 : parseFloat(bonoDiarioApu.toFixed(4)),
        diasContratados,
        diasNoTrabajados,
        diasVacaciones,
        diasPermisos,
        diasRendimiento,
        costoHcm: activoHcm ? costoHcm : 0,
        costoTransporte: activoTransporte ? costoTransporte : 0,
        costoEpp: activoEpp ? costoEpp : 0,
        activoHcm,
        activoTransporte,
        activoEpp,
        conceptos,
        metodo: isEnFcas ? 'indexado' : 'estandar'
      });
    }
  };

  // ── Layout Classes ───────────────────────────────────────────────────────
  const containerClasses = isPage
    ? "h-full w-full flex flex-col print:h-auto print:block print:overflow-visible"
    : "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 print:static print:h-auto print:block print:overflow-visible";

  const cardClasses = isPage
    ? "bg-slate-50/95 rounded-3xl shadow-2xl w-full max-w-6xl mx-auto flex flex-col h-full overflow-hidden border border-slate-200/80 print:border-none print:shadow-none print:overflow-visible print:h-auto print:block"
    : "bg-slate-50/95 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/80 print:border-none print:shadow-none print:max-h-none print:overflow-visible print:h-auto print:block";

  const savedCount = Object.keys(savedProfiles || {}).length;

  return (
    <div className={containerClasses}>
      <div className={cardClasses}>
        
        {/* HEADER BAR */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 print:bg-white print:shadow-none">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 bg-blue-600 text-white rounded-xl shadow-sm">
                <Layers size={18} />
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">
                Calculo del Factor de Costos Asociados al Salario (FCAS)
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Fórmula Expandida de Base Anual (LOTTT, Convención Colectiva y CostBase) • Todos los campos 100% editables
            </p>
          </div>
          
          <div className="flex items-center flex-wrap gap-2 print:hidden">
            {/* Abrir Cálculo */}
            <button
              type="button"
              onClick={() => setShowOpenModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl transition-all border border-sky-200 shadow-sm"
              title="Abrir un cálculo guardado"
            >
              <FolderOpen size={14} />
              <span>Abrir</span>
              {savedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-sky-600 text-white text-[10px] font-black rounded-full">
                  {savedCount}
                </span>
              )}
            </button>

            {/* Guardar Como */}
            <button
              type="button"
              onClick={() => {
                setNewProfileName('');
                setShowSaveModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all border border-blue-200 shadow-sm"
              title="Guardar cálculo actual con un nombre"
            >
              <Save size={14} />
              <span>Guardar Como</span>
            </button>

            {/* Restaurar */}
            <button
              type="button"
              onClick={resetearValores}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-300"
              title="Restaurar parámetros predeterminados de calibración"
            >
              <RotateCcw size={13} />
              <span>Restaurar</span>
            </button>

            {/* Imprimir */}
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 hover:text-slate-900 border border-slate-200"
              title="Imprimir cálculo"
            >
              <Printer size={15} />
            </button>

            {!isPage && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600 border border-slate-200"
                title="Cerrar ventana"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* SCROLLABLE CONTENT BODY */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 space-y-5 print:p-4 print:overflow-visible">
          
          {/* =========================================================================
              BLOQUE 1: VARIABLES ECONÓMICAS MAESTRAS (SALARIO Y BONO)
             ========================================================================= */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-blue-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  1. Parámetros Económicos y Tabulador Salarial
                </h4>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Sueldo Mensual Base */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  Sueldo Base Mensual
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                  <DecimalInput
                    value={salarioBase}
                    onChange={handleSalarioBaseChange}
                    className="w-full bg-slate-50 rounded-xl border border-slate-300 pl-7 pr-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Remuneración fija mensual contractual</p>
              </div>

              {/* Salario Básico Diario (Sb) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Salario Diario (S<sub>b</sub>)</span>
                  <span className="text-[10px] text-blue-600 font-semibold">Sb = Mensual/30</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                  <DecimalInput
                    value={salarioDiario}
                    onChange={handleSalarioDiarioChange}
                    decimals={2}
                    className="w-full bg-slate-50 rounded-xl border border-slate-300 pl-7 pr-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Base diaria para días equivalentes</p>
              </div>

              {/* Cestaticket Mensual */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Cestaticket / Bono</span>
                  <span className="text-[10px] text-emerald-600 font-semibold">${(bonoCestaticket*12).toFixed(0)}/año</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                  <DecimalInput
                    value={bonoCestaticket}
                    onChange={(val) => setBonoCestaticket(Math.max(0, val))}
                    className="w-full bg-slate-50 rounded-xl border border-slate-300 pl-7 pr-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Bono de alimentación e ingreso mínimo</p>
              </div>
            </div>
          </div>

          {/* =========================================================================
              BLOQUE 2: DENOMINADOR (DT) - DÍAS EFECTIVAMENTE LABORADOS
             ========================================================================= */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-amber-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  2. Denominador: Días Efectivamente Laborados en Obra (DT)
                </h4>
              </div>
              <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                DT = {dtLaborados} días laborados
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
              {/* Días Calendario de Obra */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Días Calendario (N)
                </label>
                <DecimalInput
                  value={diasContratados}
                  onChange={(val) => setDiasContratados(Math.max(1, val))}
                  className="w-full bg-slate-50 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-amber-600 focus:bg-white"
                />
                <p className="text-[10px] text-slate-500">Base estándar: 365 días</p>
              </div>

              {/* Días Descanso y Feriados (Ti) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Descansos (Ti)
                  </label>
                  <button
                    type="button"
                    onClick={() => setCalculoAutomatico(!calculoAutomatico)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 ${
                      calculoAutomatico ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                    title="Alternar entre cálculo automático y manual"
                  >
                    {calculoAutomatico ? <Lock size={10} /> : <Pencil size={10} />}
                    {calculoAutomatico ? 'Auto' : 'Manual'}
                  </button>
                </div>
                <DecimalInput
                  value={diasNoTrabajados}
                  onChange={(val) => {
                    setCalculoAutomatico(false);
                    setDiasNoTrabajados(Math.min(diasContratados, val));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-bold focus:outline-none ${
                    calculoAutomatico 
                      ? 'border-emerald-300 bg-emerald-50/50 text-emerald-900' 
                      : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-amber-600 focus:bg-white'
                  }`}
                />
                <p className="text-[10px] text-slate-500">Fines de semana + Feriados</p>
              </div>

              {/* Vacaciones Disfrute */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Vacaciones (Disfrute)
                </label>
                <DecimalInput
                  value={diasVacaciones}
                  onChange={(val) => setDiasVacaciones(Math.max(0, val))}
                  className="w-full bg-slate-50 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-amber-600 focus:bg-white"
                />
                <p className="text-[10px] text-slate-500">Descanso efectivo (Art. 192)</p>
              </div>

              {/* Permisos Contractuales */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Permisos / Cláusulas
                </label>
                <DecimalInput
                  value={diasPermisos}
                  onChange={(val) => setDiasPermisos(Math.max(0, val))}
                  className="w-full bg-slate-50 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 font-bold focus:outline-none focus:border-amber-600 focus:bg-white"
                />
                <p className="text-[10px] text-slate-500">Ausencias contractuales justificadas</p>
              </div>

              {/* Factor de Rendimiento / Lluvias */}
              <div className="space-y-1.5 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                <label className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center justify-between">
                  <span>Pérdida Rendimiento</span>
                  <span className="text-[10px] text-amber-700 font-bold">Lluvias</span>
                </label>
                <DecimalInput
                  value={diasRendimiento}
                  onChange={(val) => setDiasRendimiento(Math.max(0, val))}
                  className="w-full bg-white rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <p className="text-[10px] text-amber-800 font-medium">Días deducidos de DT por clima/contingencias</p>
              </div>
            </div>
          </div>

          {/* =========================================================================
              BLOQUE 3: MATRIZ DE BENEFICIOS Y PASIVOS LEGALES (LOTTT Y CCU)
             ========================================================================= */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  3. Matriz de Beneficios y Pasivos Legales (LOTTT y CCU)
                </h4>
              </div>
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                Subtotal Legal = {diasBeneficiosLegales.toFixed(2)} días
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {conceptos.map((c, idx) => (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                    c.activo 
                      ? 'bg-white border-slate-300 shadow-sm hover:border-blue-400' 
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={c.activo}
                      onChange={() => toggleConcepto(idx)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {c.nombre}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {c.info}
                      </span>
                      {c.id === 'prestaciones' && c.activo && (
                        <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">
                          Equiv. {(c.dias * alicuotaSalarioIntegral).toFixed(2)} días (Alícuota Art. 122: {alicuotaSalarioIntegral.toFixed(4)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Input de días editable */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <DecimalInput
                      value={c.dias}
                      onChange={(val) => handleConceptoDiasChange(idx, val)}
                      disabled={!c.activo}
                      className="w-16 bg-slate-50 rounded-lg border border-slate-300 px-2 py-1 text-xs text-right font-black text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                    />
                    <span className="text-[11px] font-bold text-slate-500">días</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* =========================================================================
              BLOQUE 4: COMPENSACIONES COMERCIALES Y OPERACIÓN DE CAMPO EN USD
             ========================================================================= */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2.5">
                <label htmlFor="toggle-todos-campo" className="flex items-center gap-2 cursor-pointer select-none">
                  <HardHat size={16} className="text-emerald-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    4. Logística de Campo y Compensaciones en USD (Días Equivalentes)
                  </h4>
                </label>
                <input
                  type="checkbox"
                  id="toggle-todos-campo"
                  checked={algunoCampoActivo}
                  ref={(el) => {
                    if (el) el.indeterminate = algunoCampoActivo && !todosCampoActivos;
                  }}
                  onChange={handleToggleTodosCampo}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  title="Activar o desactivar todos los ítems de logística de campo"
                />
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                Subtotal Campo = {dpCampoTotal.toFixed(2)} días
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Póliza HCM */}
              <div className={`space-y-1.5 p-3 rounded-xl border transition-all ${
                activoHcm ? 'border-slate-300 bg-white shadow-2xs' : 'border-slate-200 bg-slate-50 opacity-60'
              }`}>
                <div className="flex items-center justify-between gap-1">
                  <label className="flex items-center gap-2 cursor-pointer min-w-0 select-none">
                    <input
                      type="checkbox"
                      checked={activoHcm}
                      onChange={(e) => setActivoHcm(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 truncate">
                      <HeartPulse size={14} className="text-rose-500 shrink-0" /> Póliza HCM
                    </span>
                  </label>
                  <span className={`text-[11px] font-black shrink-0 ${activoHcm ? 'text-blue-700' : 'text-slate-400'}`}>
                    {diasHcm.toFixed(2)} días
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                  <DecimalInput
                    value={costoHcm}
                    onChange={(val) => setCostoHcm(Math.max(0, val))}
                    disabled={!activoHcm}
                    className={`w-full rounded-lg border pl-6 pr-2.5 py-1.5 text-sm font-bold transition-all ${
                      activoHcm 
                        ? 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500' 
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-slate-500">Costo anual póliza gremial por trabajador</p>
              </div>

              {/* Transporte Obligatorio */}
              <div className={`space-y-1.5 p-3 rounded-xl border transition-all ${
                activoTransporte ? 'border-slate-300 bg-white shadow-2xs' : 'border-slate-200 bg-slate-50 opacity-60'
              }`}>
                <div className="flex items-center justify-between gap-1">
                  <label className="flex items-center gap-2 cursor-pointer min-w-0 select-none">
                    <input
                      type="checkbox"
                      checked={activoTransporte}
                      onChange={(e) => setActivoTransporte(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 truncate">
                      <Truck size={14} className="text-blue-500 shrink-0" /> Transporte
                    </span>
                  </label>
                  <span className={`text-[11px] font-black shrink-0 ${activoTransporte ? 'text-blue-700' : 'text-slate-400'}`}>
                    {diasTransporte.toFixed(2)} días
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                  <DecimalInput
                    value={costoTransporte}
                    onChange={(val) => setCostoTransporte(Math.max(0, val))}
                    disabled={!activoTransporte}
                    className={`w-full rounded-lg border pl-6 pr-2.5 py-1.5 text-sm font-bold transition-all ${
                      activoTransporte 
                        ? 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500' 
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-slate-500">Logística de ruta diaria de personal</p>
              </div>

              {/* Dotación EPP e Uniformes */}
              <div className={`space-y-1.5 p-3 rounded-xl border transition-all ${
                activoEpp ? 'border-slate-300 bg-white shadow-2xs' : 'border-slate-200 bg-slate-50 opacity-60'
              }`}>
                <div className="flex items-center justify-between gap-1">
                  <label className="flex items-center gap-2 cursor-pointer min-w-0 select-none">
                    <input
                      type="checkbox"
                      checked={activoEpp}
                      onChange={(e) => setActivoEpp(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 truncate">
                      <ShieldCheck size={14} className="text-amber-500 shrink-0" /> Dotación EPP
                    </span>
                  </label>
                  <span className={`text-[11px] font-black shrink-0 ${activoEpp ? 'text-blue-700' : 'text-slate-400'}`}>
                    {diasEpp.toFixed(2)} días
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                  <DecimalInput
                    value={costoEpp}
                    onChange={(val) => setCostoEpp(Math.max(0, val))}
                    disabled={!activoEpp}
                    className={`w-full rounded-lg border pl-6 pr-2.5 py-1.5 text-sm font-bold transition-all ${
                      activoEpp 
                        ? 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500' 
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-slate-500">Uniformes, botas de seguridad y cascos</p>
              </div>
            </div>
          </div>

          {/* =========================================================================
              BLOQUE 5: TRATAMIENTO DEL BONO Y RESULTADOS DEL FCAS
             ========================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-slate-700" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  5. Tratamiento del Bono y Resultados del FCAS
                </h4>
              </div>
              <span className="text-xs font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                DT = {dtLaborados.toFixed(0)} días laborados
              </span>
            </div>

            {/* CÁLCULOS SIMULTÁNEOS LADO A LADO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* OPCIÓN 1: BONO EN FCAS */}
              <div 
                className="p-5 rounded-2xl border-2 transition-all flex flex-col justify-between bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 border-emerald-400 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                      Bono en FCAS
                    </span>
                  </div>

                  {/* Porcentaje Gigante */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Factor FCAS Calculado
                    </span>
                    <div className="text-4xl sm:text-5xl font-black text-emerald-600 tracking-tight mt-1">
                      {fcasConBono.toFixed(2)}%
                    </div>
                  </div>

                  {/* Desglose de Parámetros */}
                  <div className="bg-white/80 rounded-xl p-3 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Días sumados por bono:</span>
                      <strong className="text-emerald-700 font-bold">+{diasBonoPotenciales.toFixed(2)} días</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Total Días Pagados (DP):</span>
                      <strong className="text-slate-900 font-bold">{dpConBono.toFixed(2)} días</strong>
                    </div>
                  </div>
                </div>

                {/* Botón Usar FCAS (Bono en FCAS) */}
                <button
                  type="button"
                  onClick={() => handleUseFCAS(true)}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-95"
                >
                  <Check size={16} /> Usar FCAS ({fcasConBono.toFixed(2)}%)
                </button>
              </div>

              {/* OPCIÓN 2: BONO EN APU */}
              <div 
                className="p-5 rounded-2xl border-2 transition-all flex flex-col justify-between bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 border-blue-400 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-600 text-white">
                      Bono en APU
                    </span>
                  </div>

                  {/* Porcentaje Gigante */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Factor FCAS Calculado
                    </span>
                    <div className="text-4xl sm:text-5xl font-black text-blue-600 tracking-tight mt-1">
                      {fcasPuro.toFixed(2)}%
                    </div>
                  </div>

                  {/* Desglose de Parámetros */}
                  <div className="bg-white/80 rounded-xl p-3 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Días sumados por bono:</span>
                      <strong className="text-slate-500 font-bold">0.00 días (Puro Ley)</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Total Días Pagados (DP):</span>
                      <strong className="text-slate-900 font-bold">{dpSinBono.toFixed(2)} días</strong>
                    </div>
                  </div>
                </div>

                {/* Botón Usar FCAS (Bono en APU) */}
                <button
                  type="button"
                  onClick={() => handleUseFCAS(false)}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-95"
                >
                  <Check size={16} /> Usar FCAS ({fcasPuro.toFixed(2)}%)
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          MODAL ABRIR CÁLCULO GUARDADO
         ========================================================================= */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {savedCount === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-16 h-16 bg-sky-50 text-sky-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-sky-100">
                    <FolderOpen size={32} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">Aún no tienes cálculos guardados</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    Configura los parámetros laborales que necesites y haz clic en <strong className="text-slate-700">"Guardar Como"</strong> para registrar cálculos para obras específicas o licitaciones.
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
                  const modoLabel = (data.bonoInFcas || data.metodo === 'indexado') ? 'Bono en FCAS' : 'Bono en APU';
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
                            {modoLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span>Base: <strong className="text-slate-700">${data.salarioBase || 80}</strong></span>
                          <span>•</span>
                          <span>Bono: <strong className="text-slate-700">${data.bonoCestaticket || 174}</strong></span>
                          {data.diasRendimiento && (
                            <>
                              <span>•</span>
                              <span>Pérdida Rend.: {data.diasRendimiento} días</span>
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

      {/* =========================================================================
          MODAL GUARDAR CÁLCULO COMO
         ========================================================================= */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Save size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Guardar Cálculo de FCAS</h3>
                  <p className="text-xs text-slate-500">Guarda este análisis para reutilizarlo en presupuestos</p>
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
                  placeholder="Ej: Licitación Pública 2026, Privado Obra X..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium"
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Resumen a Guardar
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">FCAS Resultante:</span>
                    <p className="font-bold text-blue-600 text-sm">{fcasPorcentaje.toFixed(2)}%</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Modo de Bono:</span>
                    <p className="font-bold text-slate-800">{bonoInFcas ? 'En FCAS' : 'En APU'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Sueldo / Bono:</span>
                    <p className="font-semibold text-slate-700">${salarioBase} / ${bonoCestaticket}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Días Laborados (DT):</span>
                    <p className="font-semibold text-slate-700">{dtLaborados} días</p>
                  </div>
                </div>
              </div>

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