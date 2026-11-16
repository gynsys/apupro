import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Calculator,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FolderPlus,
  Link2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import AnimatedCursor from '../landing/preview/AnimatedCursor';

const TYPED_DESCRIPTION =
  'Remoción de capa impermeabilizante en caliente. Incluye acopio del manto removido';

const TIMELINE = [
  {
    id: 'budgets-view',
    duration: 1500,
    scene: 'budgets',
    badge: 'Paso 1 · Presupuestos',
    title: 'Abre tu presupuesto en segundos',
    subtitle: 'Selecciona cualquier proyecto desde el Gestor de Presupuestos',
    cursorIdle: { x: 74, y: 30 },
    click: false,
    zoom: { scale: 1, x: 0, y: 0 },
  },
  {
    id: 'budgets-click',
    duration: 900,
    scene: 'budgets',
    badge: 'Paso 1 · Presupuestos',
    title: 'Abre tu presupuesto en segundos',
    subtitle: 'Selecciona cualquier proyecto desde el Gestor de Presupuestos',
    target: 'budget-card',
    click: true,
    zoom: { scale: 1.05, x: 0, y: -12 },
  },
  {
    id: 'partidas-view',
    duration: 1400,
    scene: 'partidas',
    badge: 'Paso 2 · Partidas',
    title: 'Agrega una nueva partida',
    subtitle: 'Haz clic en + Agregar Partida dentro de tu presupuesto',
    cursorIdle: { x: 50, y: 46 },
    click: false,
    zoom: { scale: 1, x: 0, y: 0 },
  },
  {
    id: 'partidas-click',
    duration: 950,
    scene: 'partidas',
    badge: 'Paso 2 · Partidas',
    title: 'Agrega una nueva partida',
    subtitle: 'Haz clic en + Agregar Partida dentro de tu presupuesto',
    target: 'add-partida',
    click: true,
    zoom: { scale: 1.1, x: 24, y: 24 },
  },
  {
    id: 'search-view',
    duration: 1350,
    scene: 'search',
    badge: 'Paso 3 · Catálogo + IA',
    title: 'Elige "Crear con IA"',
    subtitle: 'Más de 10.700 partidas o generación inteligente desde cero',
    cursorIdle: { x: 35, y: 42 },
    click: false,
    zoom: { scale: 1.02, x: 0, y: 0 },
  },
  {
    id: 'search-click',
    duration: 950,
    scene: 'search',
    badge: 'Paso 3 · Catálogo + IA',
    title: 'Elige "Crear con IA"',
    subtitle: 'Más de 10.700 partidas o generación inteligente desde cero',
    target: 'create-ai',
    click: true,
    zoom: { scale: 1.1, x: -6, y: 26 },
  },
  {
    id: 'chat-welcome',
    duration: 1400,
    scene: 'chat',
    chatStage: 0,
    badge: 'Paso 4 · Asistente CostBase',
    title: 'Activa la escritura libre',
    subtitle: 'Puedes ir paso a paso o describir tu partida directamente',
    cursorIdle: { x: 40, y: 55 },
    click: false,
    zoom: { scale: 1.04, x: 0, y: 0 },
  },
  {
    id: 'chat-welcome-click',
    duration: 900,
    scene: 'chat',
    chatStage: 0,
    badge: 'Paso 4 · Asistente CostBase',
    title: 'Activa la escritura libre',
    subtitle: 'Puedes ir paso a paso o describir tu partida directamente',
    target: 'write-freely',
    click: true,
    zoom: { scale: 1.08, x: 0, y: -8 },
  },
  {
    id: 'chat-typing',
    duration: 2800,
    scene: 'chat',
    chatStage: 1,
    badge: 'Paso 5 · Descripción natural',
    title: 'Describe la partida con tus palabras',
    subtitle: 'Incluye materiales, alcance o condiciones de obra',
    target: 'chat-input',
    click: false,
    zoom: { scale: 1.06, x: 0, y: -16 },
  },
  {
    id: 'chat-send-click',
    duration: 800,
    scene: 'chat',
    chatStage: 1,
    badge: 'Paso 5 · Descripción natural',
    title: 'Describe la partida con tus palabras',
    subtitle: 'Incluye materiales, alcance o condiciones de obra',
    target: 'send-desc',
    click: true,
    zoom: { scale: 1.08, x: -12, y: -18 },
  },
  {
    id: 'chat-analysis',
    duration: 1700,
    scene: 'chat',
    chatStage: 2,
    badge: 'Paso 6 · Revisión técnica',
    title: 'La IA valida alcance y unidad',
    subtitle: 'Detecta acción, especificaciones y te pide confirmar la unidad',
    cursorIdle: { x: 45, y: 65 },
    click: false,
    zoom: { scale: 1.05, x: 0, y: -6 },
  },
  {
    id: 'chat-unit-click',
    duration: 900,
    scene: 'chat',
    chatStage: 2,
    badge: 'Paso 6 · Revisión técnica',
    title: 'La IA valida alcance y unidad',
    subtitle: 'Confirmamos m² para calcular rendimientos exactos',
    target: 'unit-m2',
    click: true,
    zoom: { scale: 1.1, x: 14, y: -14 },
  },
  {
    id: 'chat-loading',
    duration: 2000,
    scene: 'chat',
    chatStage: 3,
    badge: 'Paso 7 · Procesando APU',
    title: 'Calculando rendimientos y costos...',
    subtitle: 'Analizando materiales, equipos, mano de obra y precios',
    cursorIdle: { x: 52, y: 76 },
    click: false,
    zoom: { scale: 1.05, x: 0, y: -8 },
  },
  {
    id: 'result-view',
    duration: 1900,
    scene: 'result',
    badge: 'Paso 8 · APU Generado',
    title: '¡APU listo para tu presupuesto!',
    subtitle: 'Código E451SC001 · Rendimiento 40 m²/día · Equipos y cuadrilla',
    cursorIdle: { x: 50, y: 50 },
    click: false,
    zoom: { scale: 1.02, x: 0, y: 0 },
  },
  {
    id: 'result-save-click',
    duration: 1600,
    scene: 'result',
    badge: 'Paso 8 · Listo para usar',
    title: '¡APU listo para tu presupuesto!',
    subtitle: 'Un clic en Guardar y se integra directo a tu obra',
    target: 'save-budget',
    click: true,
    zoom: { scale: 1.1, x: -16, y: -26 },
  },
];

export default function InstagramIaApuReel({
  playing = true,
  loop = true,
  onComplete = null,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ x: 74, y: 30 });
  const innerStageRef = useRef(null);

  const step = TIMELINE[stepIndex];

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setTimeout(() => {
      setStepIndex((prev) => {
        if (prev + 1 >= TIMELINE.length) {
          if (onComplete) onComplete();
          return loop ? 0 : prev;
        }
        return prev + 1;
      });
    }, step.duration);
    return () => window.clearTimeout(timer);
  }, [stepIndex, step.duration, playing, loop, onComplete]);

  useEffect(() => {
    if (step.id === 'chat-typing') {
      setTypedChars(0);
      const interval = window.setInterval(() => {
        setTypedChars((c) => (c >= TYPED_DESCRIPTION.length ? c : c + 2));
      }, 48);
      return () => window.clearInterval(interval);
    }
    if (step.id === 'chat-send-click') {
      setTypedChars(TYPED_DESCRIPTION.length);
    }
    return undefined;
  }, [step.id]);

  // Cursor lives inside innerStageRef, so getBoundingClientRect() ratio is invariant to parent zoom/pan!
  const updateCursorPosition = useCallback(() => {
    const stageEl = innerStageRef.current;
    if (!stageEl) return;

    if (!step.target) {
      if (step.cursorIdle) setCursorPosition(step.cursorIdle);
      return;
    }

    const targetEl = stageEl.querySelector(`[data-demo-target="${step.target}"]`);
    if (!targetEl) {
      if (step.cursorIdle) setCursorPosition(step.cursorIdle);
      return;
    }

    const stageRect = stageEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    if (stageRect.width === 0 || stageRect.height === 0) return;

    const x = ((targetRect.left + targetRect.width / 2 - stageRect.left) / stageRect.width) * 100;
    const y = ((targetRect.top + targetRect.height / 2 - stageRect.top) / stageRect.height) * 100;
    setCursorPosition({ x, y });
  }, [step]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updateCursorPosition);
    const settleTimer = window.setTimeout(updateCursorPosition, 80);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(settleTimer);
    };
  }, [updateCursorPosition]);

  const progressPct = ((stepIndex + 1) / TIMELINE.length) * 100;
  const showPartidasBase = step.scene === 'partidas' || step.scene === 'search' || step.scene === 'chat';

  return (
    <div className="relative flex h-[960px] w-[540px] flex-col justify-between overflow-hidden bg-gradient-to-b from-slate-950 via-[#0a1628] to-slate-950 px-5 pb-16 pt-14 text-white select-none font-sans">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-12 right-0 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

      {/* Top Hook & Step Caption (crossfade without blank gap) */}
      <div className="relative z-20 flex flex-col items-center text-center">
        <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/15 px-3.5 py-1 text-[11px] font-bold tracking-wide text-blue-300 backdrop-blur-sm">
          <Sparkles size={13} className="text-amber-300" />
          <span>{step.badge}</span>
        </div>

        <div className="relative min-h-[78px] w-full">
          <AnimatePresence initial={false}>
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute inset-x-0 top-0"
            >
              <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-white">
                {step.title}
              </h1>
              <p className="mt-1.5 px-3 text-[13px] font-medium leading-snug text-slate-300">
                {step.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Center Stage */}
      <div className="relative z-10 my-auto flex flex-col">
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
          <div className="flex h-8 items-center gap-2 border-b border-slate-800 bg-slate-950 px-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <div className="mx-auto rounded bg-slate-800/80 px-3 py-0.5 font-mono text-[10px] text-slate-300">
              costbase.net
            </div>
          </div>

          <div className="relative h-[530px] w-full overflow-hidden bg-[#f0f4fd] text-slate-800">
            <motion.div
              ref={innerStageRef}
              className="relative h-full w-full origin-center"
              animate={{
                scale: step.zoom.scale,
                x: step.zoom.x,
                y: step.zoom.y,
              }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Layer 1: Budgets */}
              <AnimatePresence initial={false}>
                {step.scene === 'budgets' && (
                  <SceneBudgets active={step.id === 'budgets-click'} />
                )}
              </AnimatePresence>

              {/* Layer 2: Partidas (stays mounted underneath Search & Chat modals) */}
              <AnimatePresence>
                {showPartidasBase && (
                  <ScenePartidas addActive={step.id === 'partidas-click'} />
                )}
              </AnimatePresence>

              {/* Layer 3: Search Modal Overlay */}
              <AnimatePresence>
                {step.scene === 'search' && (
                  <SceneSearch aiActive={step.id === 'search-click'} />
                )}
              </AnimatePresence>

              {/* Layer 4: Persistent Chat Modal across stages 0..3 */}
              <AnimatePresence>
                {step.scene === 'chat' && (
                  <SceneChatPersistent
                    chatStage={step.chatStage}
                    freeActive={step.id === 'chat-welcome-click'}
                    typedText={TYPED_DESCRIPTION.slice(0, typedChars)}
                    sendActive={step.id === 'chat-send-click'}
                    unitActive={step.id === 'chat-unit-click'}
                  />
                )}
              </AnimatePresence>

              {/* Layer 5: Final APU Result */}
              <AnimatePresence>
                {step.scene === 'result' && (
                  <SceneApuResult saveActive={step.id === 'result-save-click'} />
                )}
              </AnimatePresence>

              <AnimatedCursor
                position={cursorPosition}
                visible={true}
                clicking={step.click}
                alwaysVisible={true}
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom Progress & Brand */}
      <div className="relative z-20 flex flex-col gap-2.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-200">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            CostBase IA · Presupuestos y APU
          </span>
          <span>costbase.net</span>
        </div>
      </div>
    </div>
  );
}

function SceneBudgets({ active }) {
  return (
    <motion.div
      key="budgets"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.28, ease: 'easeInOut' }}
      className="absolute inset-0 flex flex-col bg-[#f0f4fd] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-extrabold text-blue-700">CostBase</span>
        <div className="flex items-center gap-1.5 text-[9px] font-semibold">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Online</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Modo Obra</span>
        </div>
      </div>

      <div className="mb-3">
        <h2 className="text-lg font-extrabold text-blue-700">Gestor de Presupuestos</h2>
        <p className="text-[11px] text-slate-500">Administra, crea y organiza todos tus proyectos</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px] font-semibold text-white">
        <span className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5"><Plus size={12} /> Nuevo</span>
        <span className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5"><Upload size={12} /> Desde Archivos</span>
        <span className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5"><Database size={12} /> Desde *.mdb</span>
        <span className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5"><Link2 size={12} /> Enlace</span>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[11px] text-slate-400">
        <Search size={14} />
        <span>Buscar presupuestos por nombre...</span>
      </div>

      <div
        data-demo-target="budget-card"
        className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3.5 transition-all duration-300 ${
          active
            ? '-translate-y-0.5 border-amber-400 bg-amber-50 shadow-md'
            : 'border-slate-200 bg-white shadow-sm'
        }`}
      >
        <div>
          <p className="text-xs font-extrabold text-slate-800">Presupuesto de Ejemplo costbase.net</p>
          <div className="mt-1 flex items-center gap-3 text-[10px]">
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Partidas: 7</span>
            <span className="text-slate-400">30/8/2026</span>
          </div>
        </div>
        <span className="text-sm font-extrabold text-amber-900">$ 1.568,62</span>
      </div>
    </motion.div>
  );
}

function ScenePartidas({ addActive }) {
  const rows = [
    { code: 'E121400000', desc: 'DEFORESTACION LIVIANA Y LIMPIEZA PARA TERRACEO...', unit: 'ha', total: '1.062,31', highlight: true },
    { code: 'E211200000', desc: 'EXCAVACION PARA BANQUEOS INCLUYENDO CARGA...', unit: 'm3', total: '12,47' },
    { code: 'E221000000', desc: 'CONSTRUCCION DE TERRAPLENES, UTILIZANDO MATERIAL...', unit: 'm3', total: '13,22' },
  ];

  return (
    <motion.div
      key="partidas"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="absolute inset-0 flex flex-col bg-[#f0f4fd] p-3.5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-slate-200 p-1 text-slate-500"><ArrowLeft size={13} /></span>
          <div>
            <p className="text-xs font-extrabold text-slate-800">Presupuesto de Ejemplo costbase.net</p>
            <p className="text-[9px] text-slate-400">Total Partidas: 7 · USD</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-demo-target="add-partida"
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition-all ${
              addActive ? 'scale-95 bg-blue-700 ring-4 ring-blue-300' : 'bg-blue-600'
            }`}
          >
            <Plus size={12} /> Agregar Partida
          </button>
          <span className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-600">
            <FolderPlus size={11} /> + Capítulo
          </span>
          <span className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-semibold text-emerald-700">
            <FileSpreadsheet size={11} /> Excel
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="grid grid-cols-[76px_1fr_40px_64px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-bold uppercase text-slate-500">
          <span>Código</span>
          <span>Descripción</span>
          <span className="text-right">Und</span>
          <span className="text-right">Total</span>
        </div>
        <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[10px] font-extrabold text-slate-700">
          OBRAS PRELIMINARES
        </div>
        {rows.map((r) => (
          <div
            key={r.code}
            className={`grid grid-cols-[76px_1fr_40px_64px] items-center border-b border-slate-100 px-3 py-2.5 text-[10px] ${
              r.highlight ? 'bg-amber-50/90' : 'bg-white'
            }`}
          >
            <span className="font-mono text-[9px] text-slate-500">{r.code}</span>
            <span className="truncate pr-2 font-medium text-slate-700">{r.desc}</span>
            <span className="text-right text-slate-500">{r.unit}</span>
            <span className="text-right font-bold text-slate-800">{r.total}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
          <p className="font-bold text-slate-500">INCIDENCIA</p>
          <p className="mt-1 text-slate-600">Equipos: <span className="font-bold text-slate-800">88.3%</span></p>
          <p className="text-slate-600">Mano de obra: <span className="font-bold text-slate-800">11.7%</span></p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-right">
          <p className="text-slate-500">SUBTOTAL: <span className="font-bold text-slate-800">1.352,26</span></p>
          <p className="text-slate-500">I.V.A. (16%): <span className="font-bold text-slate-800">216,36</span></p>
          <p className="mt-0.5 font-extrabold text-blue-700">TOTAL: $ 1.568,62</p>
        </div>
      </div>
    </motion.div>
  );
}

function SceneSearch({ aiActive }) {
  return (
    <motion.div
      key="search"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/55 p-3 backdrop-blur-[1px]"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.26, ease: 'easeOut' }}
        className="w-full rounded-2xl border border-amber-300/60 bg-[#fff8dc] p-3.5 shadow-2xl"
      >
        <div className="mb-2.5 flex items-center justify-between border-b border-amber-200 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
            <Search size={14} className="text-blue-600" />
            <span>Buscar Partida</span>
          </div>
          <X size={14} className="text-slate-500" />
        </div>

        <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          <span className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-slate-700">Base Maestra</span>
          <span className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-slate-700">Presupuestos...</span>
          <button
            type="button"
            data-demo-target="create-ai"
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 transition-all ${
              aiActive
                ? 'scale-95 border-purple-500 bg-purple-600 text-white ring-4 ring-purple-300'
                : 'border-purple-300 bg-white text-purple-700 shadow-xs'
            }`}
          >
            <Sparkles size={11} /> Crear con IA
          </button>
        </div>

        <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[10px] text-slate-400">
          <Search size={12} />
          <span>Ej: excavación a máquina...</span>
        </div>
        <p className="mb-2 text-[9px] font-bold text-slate-600">10.772 Partidas</p>

        <div className="space-y-2">
          <div className="rounded-xl border border-amber-200 bg-white p-2.5">
            <div className="flex items-center justify-between">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-800">MT-R812-S/C</span>
              <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600">+ Incluir</span>
            </div>
            <p className="mt-1 text-[10px] font-medium text-slate-700">SUMINISTRO DE QUÍMICOS PARA TRATAMIENTO DE AGUA</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white p-2.5">
            <div className="flex items-center justify-between">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-800">R910122215</span>
              <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600">+ Incluir</span>
            </div>
            <p className="mt-1 text-[10px] font-medium text-slate-700">ACARREO A MANO DE ESCOMBROS CON USO DE BOLSAS</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SceneChatPersistent({ chatStage, freeActive, typedText, sendActive, unitActive }) {
  const units = ['m²', 'm³', 'ton', 'kg', 'und', 'pza', 'm', 'Gl'];

  return (
    <motion.div
      key="chat-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/55 p-3 backdrop-blur-[1px]"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.26, ease: 'easeOut' }}
        className="flex h-[460px] w-full flex-col rounded-2xl border border-amber-300 bg-[#fef3c7] p-3.5 shadow-2xl"
      >
        {/* Persistent Header */}
        <div className="mb-2.5 flex items-center justify-between border-b border-amber-200/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
              <Sparkles size={15} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-amber-900">Asistente CostBase</h3>
              <p className="text-[10px] text-amber-800">Te guiaré paso a paso para crear tu APU.</p>
            </div>
          </div>
          <X size={15} className="text-amber-700" />
        </div>

        {/* Dynamic Chat Body */}
        <div className="flex-1 space-y-2.5 overflow-hidden">
          {chatStage === 0 && (
            <motion.div
              key="stage-0"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-2.5 pt-2"
            >
              <div className="flex items-end gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Bot size={13} />
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white p-3 text-[11px] leading-relaxed text-amber-950 shadow-xs">
                  ¡Hola! Construir una descripción detallada de una partida es lo esencial para evitar ambigüedades en campo.
                  <br /><br />
                  En pocos pasos armaremos la mejor descripción. ¿Comenzamos?
                </div>
              </div>
              <div className="flex items-center gap-2 pl-8 pt-1">
                <span className="rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs">
                  Sí, comenzar
                </span>
                <button
                  type="button"
                  data-demo-target="write-freely"
                  className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all ${
                    freeActive
                      ? 'scale-95 border-amber-600 bg-amber-600 text-white ring-4 ring-amber-300'
                      : 'border-amber-300 bg-white text-amber-900 shadow-xs'
                  }`}
                >
                  Escribir libremente
                </button>
              </div>
            </motion.div>
          )}

          {chatStage === 1 && (
            <motion.div
              key="stage-1"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-2.5"
            >
              <div className="flex justify-end">
                <span className="rounded-2xl bg-amber-700 px-3 py-1.5 text-[11px] font-semibold text-white">
                  Escribir libremente
                </span>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Bot size={13} />
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white p-3 text-[11px] leading-relaxed text-amber-950 shadow-xs">
                  ¡Excelente! Escribe o pega aquí la descripción completa de tu partida (materiales, especificaciones, alcance o unidad).
                  <br /><br />
                  Realizaré un análisis de revisión y completitud técnica antes de continuar.
                </div>
              </div>
            </motion.div>
          )}

          {chatStage === 2 && (
            <motion.div
              key="stage-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-2.5"
            >
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-amber-700 px-3 py-2 text-[10px] font-semibold text-white">
                  {TYPED_DESCRIPTION}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Bot size={13} />
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white p-3 text-[10px] leading-relaxed text-amber-950 shadow-xs">
                  <p className="font-bold">📋 Análisis de Revisión y Completitud:</p>
                  <p>• Acción: Remoción</p>
                  <p>• Especificaciones: Incluye acopio del manto removido</p>
                  <p>• Unidad de cómputo: Pendiente</p>
                  <p className="mt-1 flex items-center gap-1 font-semibold text-emerald-700">
                    <CheckCircle2 size={11} /> Descripción técnica completa y estructurada.
                  </p>
                  <p className="mt-1.5 text-slate-600">Por favor selecciona o indica la unidad de cómputo:</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-8">
                {units.map((u) => (
                  <button
                    key={u}
                    type="button"
                    data-demo-target={u === 'm²' ? 'unit-m2' : undefined}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all ${
                      u === 'm²' && unitActive
                        ? 'scale-95 border-amber-600 bg-amber-600 text-white ring-4 ring-amber-300'
                        : 'border-amber-300 bg-white text-amber-900'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {chatStage === 3 && (
            <motion.div
              key="stage-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-2.5"
            >
              <div className="flex justify-end">
                <span className="rounded-2xl bg-amber-700 px-3 py-1.5 text-[11px] font-bold text-white">
                  m²
                </span>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Bot size={13} />
                </div>
                <div className="rounded-2xl border border-amber-200 bg-white p-3 text-[11px] text-amber-950 shadow-xs">
                  Unidad confirmada: «m²».
                  <br />
                  Generando APU detallado con análisis de costos y rendimientos...
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Bot size={13} />
                </div>
                <div className="w-[75%] rounded-2xl border border-amber-200 bg-white p-3 shadow-xs">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-amber-900">
                    <RefreshCw size={13} className="animate-spin text-amber-600" />
                    <span>Iniciando preproceso semántico...</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-amber-100">
                    <motion.div
                      className="h-full rounded-full bg-amber-500"
                      initial={{ width: '15%' }}
                      animate={{ width: '92%' }}
                      transition={{ duration: 1.7, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer input only during typing stage */}
        {chatStage === 1 && (
          <div className="mt-2 flex items-center gap-2 border-t border-amber-200/80 pt-2">
            <div
              data-demo-target="chat-input"
              className="flex-1 rounded-full border-2 border-amber-400 bg-white px-3 py-1.5 text-[10px] font-medium text-slate-800 shadow-inner"
            >
              {typedText}
              <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-amber-600 align-middle" />
            </div>
            <button
              type="button"
              data-demo-target="send-desc"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-all ${
                sendActive ? 'scale-90 bg-amber-600 ring-4 ring-amber-300' : 'bg-amber-500'
              }`}
            >
              <Send size={12} />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function SceneApuResult({ saveActive }) {
  return (
    <motion.div
      key="apu-result"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="absolute inset-0 z-30 flex flex-col bg-white p-3.5"
    >
      <div className="mb-2.5 flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600">
            <Sparkles size={14} />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-800">Generar APU con Inteligencia Artificial</h3>
            <p className="text-[9px] text-slate-500">Revisa y ajusta el análisis antes de incluirlo</p>
          </div>
        </div>
        <span className="rounded-lg border border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-600">
          Generar otro
        </span>
      </div>

      <div className="mb-2.5 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[9px] leading-snug text-amber-900">
        <p className="mb-1 flex items-center gap-1 font-bold">
          <AlertTriangle size={11} /> Observaciones del Análisis
        </p>
        <p>• [PRECIO_REFERENCIAL] Herramienta menor de demolición ($120.00 USD) y saco de polipropileno estimados por IA.</p>
      </div>

      <div className="mb-2.5 grid grid-cols-[74px_1fr_54px_42px] gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-[9px]">
        <div>
          <span className="block text-[8px] font-bold text-slate-400">CÓDIGO</span>
          <span className="font-mono font-bold text-slate-800">E451SC001</span>
        </div>
        <div>
          <span className="block text-[8px] font-bold text-slate-400">DESCRIPCIÓN</span>
          <span className="block truncate font-bold text-slate-800">REMOCIÓN MANUAL DE CAPA IMPERMEABILIZANTE ASFÁLTICA (MANTO)...</span>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 px-1.5 text-center">
          <span className="block text-[7px] font-bold text-amber-700">RENDIM.</span>
          <span className="font-extrabold text-amber-900">40</span>
        </div>
        <div className="text-center">
          <span className="block text-[8px] font-bold text-slate-400">UND</span>
          <span className="font-bold text-slate-800">M2</span>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-hidden text-[9px]">
        <div className="rounded-xl border border-slate-200 p-2">
          <p className="mb-1 flex items-center gap-1 font-extrabold text-orange-700">
            <Package size={11} /> 1. MATERIALES ( 1 )
          </p>
          <div className="flex justify-between text-slate-600">
            <span>Saco de polipropileno para acopio</span>
            <span className="font-bold text-slate-800">$ 0,45</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-2">
          <p className="mb-1 flex items-center gap-1 font-extrabold text-blue-700">
            <Wrench size={11} /> 2. EQUIPOS ( 1 )
          </p>
          <div className="flex justify-between text-slate-600">
            <span>Herramienta menor de demolición (pala, pico, cuña)</span>
            <span className="font-bold text-slate-800">$ 120,00</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-2">
          <p className="mb-1 flex items-center gap-1 font-extrabold text-emerald-700">
            <Calculator size={11} /> 3. MANO DE OBRA ( 2 )
          </p>
          <div className="flex justify-between text-slate-600">
            <span>1 Maestro de obra + 2 Obreros</span>
            <span className="font-bold text-slate-800">40 m²/día</span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-200 pt-2.5">
        <span className="text-[10px] font-semibold text-slate-500">Cancelar</span>
        <button
          type="button"
          data-demo-target="save-budget"
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-bold text-white shadow-md transition-all ${
            saveActive
              ? 'scale-95 bg-emerald-700 ring-4 ring-emerald-300'
              : 'bg-emerald-600'
          }`}
        >
          <Plus size={13} /> Guardar y Agregar al Presupuesto
        </button>
      </div>
    </motion.div>
  );
}
