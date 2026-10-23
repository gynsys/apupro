import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import DemoChrome from './DemoChrome';
import AnimatedCursor from './AnimatedCursor';
import ExportModal from './ExportModal';
import BudgetsScreen from './screens/BudgetsScreen';
import PartidasScreen from './screens/PartidasScreen';
import ApuScreen from './screens/ApuScreen';

const PHASES = [
  { id: 'budgets', duration: 1800 },
  { id: 'budget-click', duration: 600 },
  { id: 'partidas', duration: 1500 },
  { id: 'partidas-scroll', duration: 1200 },
  { id: 'partida-click', duration: 600 },
  { id: 'apu', duration: 1800 },
  { id: 'apu-scroll', duration: 1200 },
  { id: 'export-click', duration: 600 },
  { id: 'modal', duration: 2000 },
  { id: 'close-click', duration: 600 },
  { id: 'rewind', duration: 800 },
];

const CURSOR_POSITIONS = {
  budgets: { x: 72, y: 26 },
  'budget-click': { x: 56, y: 44 },
  partidas: { x: 61, y: 52 },
  'partidas-scroll': { x: 58, y: 50 },
  'partida-click': { x: 46, y: 57 },
  apu: { x: 77, y: 64 },
  'apu-scroll': { x: 78, y: 67 },
  'export-click': { x: 83, y: 82 },
  modal: { x: 69, y: 45 },
  'close-click': { x: 75, y: 27 },
  rewind: { x: 78, y: 35 },
};

const CLICK_PHASES = new Set(['budget-click', 'partida-click', 'export-click', 'close-click']);

function screenForPhase(phase) {
  if (phase === 'budgets' || phase === 'budget-click' || phase === 'rewind') return 'budgets';
  if (phase === 'partidas' || phase === 'partidas-scroll' || phase === 'partida-click') return 'partidas';
  return 'apu';
}

export default function AnimatedPreview() {
  const prefersReducedMotion = useReducedMotion();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { amount: 0.35 });

  const phase = PHASES[phaseIndex].id;
  const screen = screenForPhase(phase);
  const showModal = phase === 'modal' || phase === 'close-click';
  const cursorPosition = CURSOR_POSITIONS[phase];

  useEffect(() => {
    if (!isInView) setPhaseIndex(0);
  }, [isInView]);

  useEffect(() => {
    if (prefersReducedMotion || paused || !isInView) return undefined;
    const timer = window.setTimeout(() => {
      setPhaseIndex((current) => (current + 1) % PHASES.length);
    }, PHASES[phaseIndex].duration);
    return () => window.clearTimeout(timer);
  }, [phaseIndex, paused, prefersReducedMotion, isInView]);

  const screenContent = useMemo(() => {
    if (screen === 'budgets') {
      return <BudgetsScreen activeBudget={phase === 'budget-click' ? 1 : null} />;
    }
    if (screen === 'partidas') {
      return (
        <PartidasScreen
          activePartida={phase === 'partida-click'}
          scrolled={phase === 'partidas-scroll' || phase === 'partida-click'}
        />
      );
    }
    return (
      <ApuScreen
        scrolled={phase === 'apu-scroll' || phase === 'export-click' || showModal}
        exportActive={phase === 'export-click'}
      />
    );
  }, [screen, phase]);

  if (prefersReducedMotion) {
    return (
      <DemoChrome>
        <BudgetsScreen activeBudget={null} />
      </DemoChrome>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <DemoChrome>
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            className="absolute inset-0"
            initial={{ opacity: 0, x: phase === 'rewind' ? -140 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: phase === 'rewind' ? 140 : -16 }}
            transition={{ duration: phase === 'rewind' ? 0.55 : 0.38, ease: 'easeInOut' }}
          >
            {screenContent}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>{showModal && <ExportModal closeActive={phase === 'close-click'} />}</AnimatePresence>

        <AnimatedCursor
          position={cursorPosition}
          visible={phase !== 'rewind'}
          clicking={CLICK_PHASES.has(phase)}
        />
      </DemoChrome>

      <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
        Recorrido interactivo · presupuesto → partidas → APU → Excel
      </p>
    </div>
  );
}
