import React from 'react';
import {
  ArrowLeft,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Package,
  Printer,
  Search,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { demoEquipment, demoLabor, demoMaterials } from '../demoData';

function SectionHeader({ icon: Icon, title, tone }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-400 bg-slate-100 px-3 py-1.5">
      <Icon className={tone} size={15} />
      <h3 className={`text-[10px] font-bold tracking-wide ${tone}`}>{title}</h3>
    </div>
  );
}

function TotalRow({ label, value }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-slate-300 bg-slate-50 px-3 py-1.5">
      <span className="text-[9px] font-bold uppercase text-slate-600">{label}</span>
      <span className="min-w-[90px] rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-[11px] font-black text-slate-800">
        {value}
      </span>
    </div>
  );
}

export default function ApuScreen({ scrolled, exportActive, onExportClick }) {
  return (
    <div className="flex h-full flex-col bg-[#f0f4fd]">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/95 px-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 shadow-sm" title="Volver">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-sm">
            <Calculator size={13} className="text-blue-600" />
            <span className="font-mono text-[11px] font-black text-slate-800">5/16</span>
          </div>
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button type="button" className="rounded p-1 text-slate-700"><ChevronLeft size={15} /></button>
            <span className="mx-0.5 h-3 w-px bg-slate-200" />
            <button type="button" className="rounded p-1 text-slate-700"><ChevronRight size={15} /></button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm lg:flex">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">Cant:</span>
            <span className="text-[11px] font-bold text-slate-800">180,00</span>
            <span className="rounded border border-slate-200 bg-slate-100 px-1 text-[8px] font-bold text-slate-600">m2</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2 py-1 shadow-sm">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-emerald-600">P.U:</span>
            <span className="text-[11px] font-bold text-emerald-700">$ 9,35</span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2 py-1 shadow-sm xl:flex">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-blue-600">Total Partida:</span>
            <span className="text-[11px] font-bold text-blue-700">$ 1.683,00</span>
          </div>
          <button type="button" className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-500 shadow-sm" title="Imprimir">
            <Printer size={15} />
          </button>
          <button
            type="button"
            onClick={onExportClick}
            data-demo-target="export"
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[9px] font-bold shadow-sm transition-all duration-300 ${
              exportActive
                ? 'border-emerald-500 bg-emerald-500 text-white ring-2 ring-emerald-200'
                : 'border-emerald-600 bg-emerald-600 text-white'
            }`}
            title="Exportar a Excel"
          >
            <FileSpreadsheet size={14} />
            Excel
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <motion.div
          animate={{ y: scrolled ? -170 : 0 }}
          transition={{ duration: 0.85, ease: 'easeInOut' }}
          className="space-y-2.5 p-3"
        >
          <div className="rounded-xl border-2 border-slate-200 bg-white p-2.5 shadow-sm">
            <div className="flex items-end gap-2">
              <div className="w-[72px] shrink-0">
                <span className="mb-0.5 block text-[8px] font-bold uppercase text-slate-400">Código</span>
                <div className="rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-[10px] font-bold text-slate-800">
                  5
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <span className="mb-0.5 block text-[8px] font-bold uppercase text-slate-400">Descripción</span>
                <div className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-800">
                  Pintura elastomérica para techos
                </div>
              </div>
              <div className="w-[42px] shrink-0">
                <span className="mb-0.5 block text-center text-[8px] font-bold uppercase text-slate-400">Cant.</span>
                <div className="rounded border border-slate-200 bg-slate-100 px-1 py-1 text-center text-[10px] font-bold text-slate-700">1</div>
              </div>
              <div className="w-[48px] shrink-0">
                <span className="mb-0.5 block text-center text-[8px] font-bold uppercase text-amber-700/80">Rend.</span>
                <div className="rounded border border-amber-300 bg-amber-50 px-1 py-1 text-center text-[10px] font-bold text-amber-900">1,00</div>
              </div>
              <div className="w-[36px] shrink-0">
                <span className="mb-0.5 block text-center text-[8px] font-bold uppercase text-slate-400">Und.</span>
                <div className="rounded border border-slate-300 bg-slate-50 px-1 py-1 text-center text-[10px] font-bold uppercase text-slate-700">m2</div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-400 bg-white shadow-sm">
            <SectionHeader icon={Package} title="1. MATERIALES ( 4 )" tone="text-orange-600" />
            <div className="grid grid-cols-[46px_1fr_34px_38px_42px_58px_58px_32px] border-b border-slate-200 bg-white px-2 py-1 text-[7px] font-bold text-slate-600">
              <span>Ref.</span>
              <span>Descripción</span>
              <span className="text-center">Und.</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Desp.</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {demoMaterials.map((material) => (
              <div
                key={material.code}
                className="grid grid-cols-[46px_1fr_34px_38px_42px_58px_58px_32px] items-center border-b border-slate-100 px-2 py-[5px] text-[9px] text-slate-700"
              >
                <span className="font-mono text-[8px]">{material.code}</span>
                <span className="truncate pr-1">{material.description}</span>
                <span className="text-center text-[8px]">{material.unit}</span>
                <span className="text-right">{material.qty}</span>
                <span className="text-right text-slate-400">0</span>
                <span className="text-right text-slate-500">{material.price}</span>
                <span className="text-right font-semibold">{material.total}</span>
                <span className="flex justify-end gap-0.5 text-slate-400">
                  <Search size={10} />
                  <Trash2 size={10} />
                </span>
              </div>
            ))}
            <TotalRow label="Total Materiales:" value="$ 5,81" />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-400 bg-white shadow-sm">
            <SectionHeader icon={Wrench} title="2. EQUIPOS ( 2 )" tone="text-indigo-600" />
            <div className="grid grid-cols-[46px_1fr_34px_40px_58px_64px_32px] border-b border-slate-200 bg-white px-2 py-1 text-[7px] font-bold text-slate-600">
              <span>Ref.</span>
              <span>Descripción</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Deprec.</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Total Día</span>
              <span />
            </div>
            {demoEquipment.map((equipment) => (
              <div
                key={equipment.code}
                className="grid grid-cols-[46px_1fr_34px_40px_58px_64px_32px] items-center border-b border-slate-100 px-2 py-[5px] text-[9px] text-slate-700"
              >
                <span className="font-mono text-[8px]">{equipment.code}</span>
                <span className="truncate pr-1">{equipment.description}</span>
                <span className="text-right">{equipment.qty}</span>
                <span className="text-right text-slate-400">{equipment.deprec}</span>
                <span className="text-right text-slate-500">{equipment.price}</span>
                <span className="text-right font-semibold">{equipment.total}</span>
                <span className="flex justify-end gap-0.5 text-slate-400">
                  <Search size={10} />
                  <Trash2 size={10} />
                </span>
              </div>
            ))}
            <TotalRow label="Total Equipos:" value="$ 1,18" />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-400 bg-white shadow-sm">
            <SectionHeader icon={Users} title="3. MANO DE OBRA ( 2 )" tone="text-teal-600" />
            <div className="grid grid-cols-[46px_1fr_34px_44px_52px_64px_32px] border-b border-slate-200 bg-white px-2 py-1 text-[7px] font-bold text-slate-600">
              <span>Ref.</span>
              <span>Descripción</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Jornal</span>
              <span className="text-right">Bono</span>
              <span className="text-right">Total</span>
              <span />
            </div>
            {demoLabor.map((labor) => (
              <div
                key={labor.code}
                className="grid grid-cols-[46px_1fr_34px_44px_52px_64px_32px] items-center border-b border-slate-100 px-2 py-[5px] text-[9px] text-slate-700"
              >
                <span className="font-mono text-[8px]">{labor.code}</span>
                <span className="truncate pr-1">{labor.description}</span>
                <span className="text-right">{labor.qty}</span>
                <span className="text-right text-slate-500">{labor.jornal}</span>
                <span className="text-right text-slate-400">$ 0,00</span>
                <span className="text-right font-semibold">{labor.total}</span>
                <span className="flex justify-end gap-0.5 text-slate-400">
                  <Search size={10} />
                  <Trash2 size={10} />
                </span>
              </div>
            ))}
            <TotalRow label="Total Mano de Obra:" value="$ 3,66" />
          </div>
        </motion.div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#f0f4fd] to-transparent" />
      </div>
    </div>
  );
}
