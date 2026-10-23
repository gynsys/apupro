import React from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Package,
  Save,
  Users,
  Wrench,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { demoEquipment, demoLabor, demoMaterials } from '../demoData';

function SectionTitle({ icon: Icon, children, tone = 'text-orange-700 bg-orange-50 border-orange-200' }) {
  return (
    <div className={`mb-1.5 flex items-center gap-1 border-b px-1 pb-1 text-[9px] font-extrabold tracking-wide ${tone}`}>
      <Icon size={11} />
      {children}
    </div>
  );
}

export default function ApuScreen({ scrolled, exportActive, onExportClick }) {
  return (
    <div className="flex h-full flex-col bg-[#f0f4fd]">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4">
        <div className="rounded-lg border border-slate-200 p-1.5 text-slate-500">
          <ArrowLeft size={16} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-extrabold text-slate-800">APU · Pintura elastomérica para techos</p>
          <p className="text-[9px] text-slate-400">Partida 5 · m2 · Rendimiento 1,00</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-500">
            <Save size={10} className="mr-1 inline" />
            Guardado
          </span>
          <span className="rounded-md bg-slate-900 px-2 py-1 text-[9px] font-bold text-white">
            P.U. <span className="text-emerald-300">$ 9,35</span>
          </span>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-800">Análisis de Precio Unitario</h3>
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-400">
            USD
          </span>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <motion.div
            animate={{ y: scrolled ? -104 : 0 }}
            transition={{ duration: 0.85, ease: 'easeInOut' }}
            className="p-3"
          >
            <SectionTitle icon={Package}>1. MATERIALES</SectionTitle>
            <div className="grid grid-cols-[48px_1fr_38px_34px_52px] border-b border-slate-100 pb-0.5 text-[8px] font-bold uppercase text-slate-400">
              <span>Ref.</span>
              <span>Descripción</span>
              <span className="text-right">Und.</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Total</span>
            </div>
            {demoMaterials.map((material) => (
              <div
                key={material.code}
                className="grid grid-cols-[48px_1fr_38px_34px_52px] items-center border-b border-slate-50 py-[5px] text-[10px] text-slate-600"
              >
                <span className="font-mono text-[8px] text-slate-400">{material.code}</span>
                <span className="truncate pr-1">{material.description}</span>
                <span className="text-right text-slate-400">{material.unit}</span>
                <span className="text-right">{material.qty}</span>
                <span className="text-right font-semibold text-slate-700">{material.total}</span>
              </div>
            ))}

            <div className="mt-2">
              <SectionTitle icon={Wrench} tone="text-indigo-700 bg-indigo-50 border-indigo-200">
                2. EQUIPOS
              </SectionTitle>
              {demoEquipment.map((equipment) => (
                <div
                  key={equipment.code}
                  className="grid grid-cols-[48px_1fr_38px_52px] items-center border-b border-slate-50 py-[5px] text-[10px] text-slate-600"
                >
                  <span className="font-mono text-[8px] text-slate-400">{equipment.code}</span>
                  <span className="truncate pr-1">{equipment.description}</span>
                  <span className="text-right text-slate-400">{equipment.deprec}</span>
                  <span className="text-right font-semibold text-slate-700">{equipment.total}</span>
                </div>
              ))}
            </div>

            <div className="mt-2">
              <SectionTitle icon={Users} tone="text-teal-700 bg-teal-50 border-teal-200">
                3. MANO DE OBRA
              </SectionTitle>
              {demoLabor.map((labor) => (
                <div
                  key={labor.code}
                  className="grid grid-cols-[48px_1fr_38px_52px] items-center border-b border-slate-50 py-[5px] text-[10px] text-slate-600"
                >
                  <span className="font-mono text-[8px] text-slate-400">{labor.code}</span>
                  <span className="truncate pr-1">{labor.description}</span>
                  <span className="text-right text-slate-400">{labor.jornal}</span>
                  <span className="text-right font-semibold text-slate-700">{labor.total}</span>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[9px] font-bold text-slate-600">
              <span>Total materiales + equipos + mano de obra</span>
              <span className="text-slate-800">$ 7,94</span>
            </div>
          </motion.div>
        </div>

        <div className="mt-3 flex shrink-0 items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[9px] text-slate-400">
            <ChevronDown size={10} />
            Totales del APU
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-500">
              <Download size={10} className="mr-1 inline" />
              PDF
            </span>
            <button
              type="button"
              onClick={onExportClick}
              data-demo-target="export"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[9px] font-bold text-white shadow-sm transition-all duration-300 ${
                exportActive ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-emerald-600'
              }`}
            >
              <FileSpreadsheet size={12} />
              Exportar a Excel
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
