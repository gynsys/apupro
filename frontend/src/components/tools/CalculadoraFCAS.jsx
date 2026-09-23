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
  initialMetodo = 'estandar',
  savedProfiles = {},
  onSaveProfile = null,
  onDeleteProfile = null
}) {
  // ── 1. Parámetros Económicos Maestros (100% Editables) ───────────────────
  const [salarioBase, setSalarioBase] = useState(initialSalarioBase || 80); // $ mensuales
  const [salarioDiario, setSalarioDiario] = useState((initialSalarioBase || 80) / 30); // $ diario (Sb)
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
      setSalarioDiario(initialSalarioBase / 30);
    }
    if (initialBonoCestaticket != null) setBonoCestaticket(initialBonoCestaticket);
    if (initialBonoInFcas != null) {
      setBonoInFcas(Boolean(initialBonoInFcas));
    } else if (initialMetodo) {
      setBonoInFcas(initialMetodo === 'indexado');
    }
  }, [initialSalarioBase, initialBonoCestaticket, initialBonoInFcas, initialMetodo]);

  // Manejar cambio bidireccional entre Sueldo Mensual y Salario Básico Diario
  const handleSalarioBaseChange = (val) => {
    const sMensual = Math.max(0, val);
    setSalarioBase(sMensual);
    setSalarioDiario(sMensual > 0 ? sMensual / 30 : 0);
  };

  const handleSalarioDiarioChange = (val) => {
    const sDiario = Math.max(0, val);
    setSalarioDiario(sDiario);
    setSalarioBase(sDiario * 30);
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
  const { diasHcm, diasTransporte, diasEpp, diasBono, dpCampoTotal } = useMemo(() => {
    const sDia = salarioDiario > 0 ? salarioDiario : (salarioBase > 0 ? salarioBase / 30 : 2.6667);
    const dHcm = sDia > 0 ? (costoHcm * factorTemporal) / sDia : 0;
    const dTransp = sDia > 0 ? (costoTransporte * factorTemporal) / sDia : 0;
    const dEpp = sDia > 0 ? costoEpp / sDia : 0; // Fijo inmutable ante obras cortas
    const dBono = (bonoInFcas && sDia > 0) ? (bonoCestaticket * 12 * factorTemporal) / sDia : 0;

    return {
      diasHcm: dHcm,
      diasTransporte: dTransp,
      diasEpp: dEpp,
      diasBono: dBono,
      dpCampoTotal: dHcm + dTransp + dEpp + dBono
    };
  }, [salarioDiario, salarioBase, costoHcm, costoTransporte, costoEpp, bonoInFcas, bonoCestaticket, factorTemporal]);

  // Total Días Pagados y Equivalentes (DP Total)
  const dpTotal = useMemo(() => {
    return diasBaseNomina + diasBeneficiosLegales + dpCampoTotal;
  }, [diasBaseNomina, diasBeneficiosLegales, dpCampoTotal]);

  // ── FCAS RESULTANTE (%) ──────────────────────────────────────────────────
  // Ecuación Universal Expandida: FCAS (%) = [(DP Total / DT) - 1] * 100
  const fcasPorcentaje = useMemo(() => {
    if (dtLaborados <= 0) return 0;
    return Math.max(0, ((dpTotal / dtLaborados) - 1) * 100);
  }, [dpTotal, dtLaborados]);

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
    setSalarioDiario((initialSalarioBase || 80) / 30);
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
      salarioDiario: parseFloat(salarioDiario.toFixed(4)),
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
      setSalarioDiario(p.salarioDiario);
    } else if (p.salarioBase != null) {
      setSalarioDiario(p.salarioBase / 30);
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
        salarioDiario: parseFloat(salarioDiario.toFixed(4)),
        bonoCestaticket,
        bonoInFcas,
        bonoDiario: parseFloat(bonoDiarioApu.toFixed(4)),
        diasContratados,
        diasNoTrabajados,
        diasVacaciones,
        diasPermisos,
        diasRendimiento,
        costoHcm,
        costoTransporte,
        costoEpp,
        conceptos,
        metodo: bonoInFcas ? 'indexado' : 'estandar'
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
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-600 text-white rounded-xl shadow-sm">
                <Layers size={18} />
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">
                Matriz Unificada Dinámica del FCAS
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

            {/* Botón Usar FCAS */}
            <button
              type="button"
              onClick={handleUseFCAS}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20"
              title="Aplicar este porcentaje FCAS y configuración de bono al presupuesto activo o perfil de costos"
            >
              <Check size={14} />
              <span>Usar FCAS</span>
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
              CARD DESTACADO: SWITCH DINÁMICO DE ASIGNACIÓN DE BONO / CESTATICKET
             ========================================================================= */}
          <div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
            bonoInFcas 
              ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-emerald-50/90 border-emerald-400 shadow-sm'
              : 'bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-blue-50/90 border-blue-400 shadow-sm'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                    bonoInFcas ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    {bonoInFcas ? 'Bono Diluido en FCAS' : 'Bono Directo en APU'}
                  </span>
                  <span className="text-xs font-bold text-slate-500">Configuración Financiera</span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                  ¿Cómo procesar el Cestaticket / Bono de Ingreso Mínimo (${bonoCestaticket.toFixed(2)}/mes)?
                </h3>
                <p className="text-xs text-slate-600 max-w-2xl">
                  {bonoInFcas ? (
                    <span>
                      <strong className="text-emerald-800">ACTIVADO:</strong> El bono se convierte en <strong className="text-emerald-800">{diasBono.toFixed(2)} días equivalentes</strong> dentro del numerador del FCAS, elevando el porcentaje. En la tarjeta de APU <strong className="text-emerald-800">no se suma bono directo</strong> para evitar duplicidad (Recomendado para auditorías públicas).
                    </span>
                  ) : (
                    <span>
                      <strong className="text-blue-800">DESACTIVADO:</strong> El bono se excluye del numerador del FCAS (<strong className="text-blue-800">0.00 días</strong>), manteniendo el porcentaje más bajo. El bono se transfiere linealmente como costo directo diario (<strong className="text-blue-800">${bonoDiarioApu.toFixed(2)}/día</strong>) dentro del APU (Recomendado para licitaciones privadas).
                    </span>
                  )}
                </p>
              </div>

              {/* Botón Toggle Interactivo */}
              <div className="shrink-0 flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bonoInFcas}
                    onChange={(e) => setBonoInFcas(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
                <div className="text-left">
                  <span className="block text-xs font-black text-slate-800">
                    {bonoInFcas ? 'En FCAS' : 'En APU'}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-500">
                    {bonoInFcas ? 'Diluido en %' : 'Costo directo'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              INDICADOR PRINCIPAL DE FCAS Y MÉTRICAS CLAVE
             ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Visualizador Principal FCAS */}
            <div className="sm:col-span-2 rounded-2xl p-5 bg-white border-2 border-slate-300 shadow-sm flex flex-col items-center justify-center text-center">
              <span className="text-xs font-black tracking-widest uppercase text-slate-600">
                Factor F.C.A.S. Calculado
              </span>
              <div className="mt-1 flex items-baseline justify-center gap-2">
                <span className={`text-4xl sm:text-5xl font-black tracking-tight ${
                  bonoInFcas ? 'text-emerald-600' : 'text-blue-600'
                }`}>
                  {fcasPorcentaje.toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-slate-600 font-bold mt-1">
                Multiplicador Jornal: <strong className="text-slate-900 font-black">{fcasMultiplicador.toFixed(4)}</strong> (1 + FCAS/100)
              </p>
            </div>

            {/* Denominador DT */}
            <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 block">
                  Denominador (DT)
                </span>
                <span className="text-2xl font-black text-slate-800">
                  {dtLaborados.toFixed(0)} <span className="text-xs font-semibold text-slate-500">días</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2 font-medium">
                Días efectivamente laborados en obra deducidos paradas y rendimiento.
              </p>
            </div>

            {/* Numerador DP */}
            <div className="rounded-2xl p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 block">
                  Numerador (DP Total)
                </span>
                <span className="text-2xl font-black text-slate-800">
                  {dpTotal.toFixed(2)} <span className="text-xs font-semibold text-slate-500">días</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2 font-medium">
                Base nómina ({diasBaseNomina}) + Ley ({diasBeneficiosLegales.toFixed(1)}) + Campo ({dpCampoTotal.toFixed(1)}).
              </p>
            </div>
          </div>

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
              <span className="text-[11px] text-slate-500 font-semibold">100% interactivo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                    decimals={4}
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

              {/* Bono Diario Equivalente para APU */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Bono Diario (APU)</span>
                  <span className="text-[10px] text-slate-500 font-semibold">(Bono*12)/N</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="text"
                    readOnly
                    value={bonoDiarioApu.toFixed(4)}
                    className="w-full bg-slate-100 rounded-xl border border-slate-200 pl-7 pr-3 py-2 text-sm text-slate-700 font-bold cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {bonoInFcas ? 'Inactivo (absorbido en FCAS)' : 'Fila directa de bono diario en APU'}
                </p>
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
              BLOQUE 3: COMPENSACIONES COMERCIALES Y OPERACIÓN DE CAMPO EN USD
             ========================================================================= */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <HardHat size={16} className="text-emerald-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  3. Logística de Campo y Compensaciones en USD (Días Equivalentes)
                </h4>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                Subtotal Campo = {dpCampoTotal.toFixed(2)} días
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Póliza HCM */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <HeartPulse size={14} className="text-rose-500" /> Póliza HCM
                  </span>
                  <span className="text-[11px] font-black text-blue-700">
                    {diasHcm.toFixed(2)} días
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                  <DecimalInput
                    value={costoHcm}
                    onChange={(val) => setCostoHcm(Math.max(0, val))}
                    className="w-full bg-white rounded-lg border border-slate-300 pl-6 pr-2.5 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Costo anual póliza gremial por trabajador</p>
              </div>

              {/* Transporte Obligatorio */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Truck size={14} className="text-blue-500" /> Transporte
                  </span>
                  <span className="text-[11px] font-black text-blue-700">
                    {diasTransporte.toFixed(2)} días
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                  <DecimalInput
                    value={costoTransporte}
                    onChange={(val) => setCostoTransporte(Math.max(0, val))}
                    className="w-full bg-white rounded-lg border border-slate-300 pl-6 pr-2.5 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Logística de ruta diaria de personal</p>
              </div>

              {/* Dotación EPP e Uniformes */}
              <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-amber-500" /> Dotación EPP
                  </span>
                  <span className="text-[11px] font-black text-blue-700">
                    {diasEpp.toFixed(2)} días
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                  <DecimalInput
                    value={costoEpp}
                    onChange={(val) => setCostoEpp(Math.max(0, val))}
                    className="w-full bg-white rounded-lg border border-slate-300 pl-6 pr-2.5 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Uniformes, botas de seguridad y cascos</p>
              </div>

              {/* Cestaticket en Matriz */}
              <div className={`space-y-1.5 p-3 rounded-xl border ${
                bonoInFcas ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-slate-100 opacity-60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <DollarSign size={14} className="text-emerald-600" /> Cestaticket Matriz
                  </span>
                  <span className={`text-[11px] font-black ${bonoInFcas ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {diasBono.toFixed(2)} días
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="text"
                    readOnly
                    value={(bonoCestaticket * 12).toFixed(2)}
                    className="w-full bg-white/80 rounded-lg border border-slate-300 pl-6 pr-2.5 py-1.5 text-sm font-bold text-slate-800 cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-600">
                  {bonoInFcas ? 'Incluido en numerador FCAS' : '0.00 días (se cobra en APU)'}
                </p>
              </div>
            </div>
          </div>

          {/* =========================================================================
              BLOQUE 4: MATRIZ DE BENEFICIOS Y PASIVOS LEGALES (LOTTT Y CCU)
             ========================================================================= */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  4. Matriz de Beneficios y Pasivos Legales (LOTTT y CCU)
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
              MEMORIA AUDITABLE: ECUACIÓN Y SÍNTESIS FINANCIERA
             ========================================================================= */}
          <div className="bg-slate-100/80 p-5 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 block">
              Memoria de Cálculo y Ecuación Expandida
            </span>
            <div className="bg-white p-3.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-800 overflow-x-auto space-y-1">
              <p>
                <strong>FCAS (%)</strong> = [ (DP Total / DT) - 1 ] &times; 100
              </p>
              <p>
                <strong>FCAS (%)</strong> = [ ({dpTotal.toFixed(2)} días / {dtLaborados.toFixed(2)} días) - 1 ] &times; 100
              </p>
              <p className="text-blue-700 font-bold">
                <strong>FCAS (%)</strong> = [ { (dpTotal / dtLaborados).toFixed(5) } - 1 ] &times; 100 = <strong>{fcasPorcentaje.toFixed(2)}%</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700 block">Impacto en Hoja de APU:</span>
                <p className="text-slate-600 mt-1">
                  Jornal Básico ($Sb) = <strong>${salarioDiario.toFixed(2)}</strong> &times; Multiplicador ({fcasMultiplicador.toFixed(4)}) = <strong>${(salarioDiario * fcasMultiplicador).toFixed(2)}/día</strong>.
                  {!bonoInFcas && (
                    <span className="text-blue-700 block font-bold mt-0.5">
                      + Bono Diario en APU: ${bonoDiarioApu.toFixed(2)}/día &rarr; Jornal Total: ${costoJornalObra.toFixed(2)}/día.
                    </span>
                  )}
                  {bonoInFcas && (
                    <span className="text-emerald-700 block font-bold mt-0.5">
                      Bono Directo en APU = $0.00 (Totalmente absorbido en el FCAS de {fcasPorcentaje.toFixed(2)}%).
                    </span>
                  )}
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700 block">Criterio de Aplicación:</span>
                <p className="text-slate-600 mt-1">
                  {bonoInFcas ? (
                    <span>Ideal para <strong>auditorías públicas, ministerios y entes gubernamentales</strong> que exigen que toda compensación de nómina esté integrada en el factor FCAS.</span>
                  ) : (
                    <span>Ideal para <strong>licitaciones privadas e inspecciones comerciales</strong> que solicitan salarios y bonos separados en renglones directos en la tarjeta de APU.</span>
                  )}
                </p>
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