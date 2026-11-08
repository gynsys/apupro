import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Layers, Plus, Ruler, X } from 'lucide-react';
import { fetchItems } from '../../costbase/services/costbaseService.js';
import {
  BLOCK_TYPES,
  DEFAULT_WALL_INPUT,
  PERIMETER_WALL_TEMPLATE,
  calculatePerimeterWall,
} from '../templates/perimeterWall.js';

function NumberField({ label, value, onChange, step = 0.01, min = 0 }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-amber-900">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-full rounded-xl border-2 border-amber-300 bg-amber-50/30 px-3 py-2 text-sm font-semibold text-amber-950 focus:border-amber-500 focus:outline-none"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-amber-950">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-amber-600"
      />
      {label}
    </label>
  );
}

export default function PerimeterWallModal({ isOpen, onClose, onApply, initialInput = null, instanceId = null }) {
  const [form, setForm] = useState(DEFAULT_WALL_INPUT);
  const [resolving, setResolving] = useState(false);
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    if (isOpen) {
      setForm({ ...DEFAULT_WALL_INPUT, ...(initialInput || {}) });
      setOverrides({});
    }
  }, [isOpen, initialInput, instanceId]);

  const preview = useMemo(() => calculatePerimeterWall(form), [form]);
  const rows = useMemo(
    () => preview.rows.map((row) => ({ ...row, ...(overrides[row.key] || {}) })),
    [preview.rows, overrides]
  );

  if (!isOpen) return null;

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setOverride = (key, field, value) => {
    setOverrides((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));
  };

  const apply = async () => {
    if (!rows.length) return;
    setResolving(true);
    try {
      const matches = await Promise.all(
        rows.map(async (row) => {
          if (overrides[row.key]?.cod_par) {
            return { ...row, match_status: 'manual' };
          }
          try {
            const result = await fetchItems(0, 3, row.description, 'master');
            const items = Array.isArray(result) ? result : (result?.items || []);
            const match = items.find((item) => item && (item.CodPar || item.cod_par));
            if (!match) return { ...row, match_status: 'description_only' };
            return {
              ...row,
              cod_par: match.CodPar || match.cod_par || '',
              cov_par: match.CovPar || match.cov_par || '',
              description: match.Descri || match.description || row.description,
              unit: match.UniPar || match.unit || row.unit,
              match_status: 'matched',
            };
          } catch (_e) {
            return { ...row, match_status: 'description_only' };
          }
        })
      );
      onApply(matches, { instanceId, input: form });
      onClose();
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[140] flex items-center justify-center bg-black/40 p-2 backdrop-blur-xs sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border-2 border-amber-300 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight text-amber-950">Incluir {PERIMETER_WALL_TEMPLATE.name}</h3>
              <p className="text-xs text-amber-800">Genera partidas y cantidades en cascada</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-amber-700 hover:bg-amber-100 hover:text-amber-950">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-[340px_1fr] sm:p-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
              <Ruler className="h-4 w-4 text-amber-600" /> Dimensiones
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Largo (m)" value={form.length} onChange={(v) => set('length', v)} />
              <NumberField label="Alto (m)" value={form.height} onChange={(v) => set('height', v)} />
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-amber-900">Tipo de bloque</span>
              <select
                value={form.blockType}
                onChange={(e) => set('blockType', e.target.value)}
                className="w-full rounded-xl border-2 border-amber-300 bg-amber-50/30 px-3 py-2 text-sm font-semibold text-amber-950 focus:border-amber-500 focus:outline-none"
              >
                {Object.entries(BLOCK_TYPES).map(([id, block]) => (
                  <option key={id} value={id}>{block.label}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Junta (m)" value={form.joint} onChange={(v) => set('joint', v)} step={0.005} />
              <div className="rounded-xl bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800">
                Bloque: {Math.round((BLOCK_TYPES[form.blockType]?.length || 0) * 100)} × {Math.round((BLOCK_TYPES[form.blockType]?.height || 0) * 100)} × {Math.round((BLOCK_TYPES[form.blockType]?.thickness || 0) * 100)} cm
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-[11px] font-bold text-amber-900">Huecos que descuentan área</p>
              <Toggle label="Portón" checked={form.includeGate} onChange={(v) => set('includeGate', v)} />
              {form.includeGate && (
                <div className="grid grid-cols-3 gap-2">
                  <NumberField label="Cantidad" value={form.gateCount} onChange={(v) => set('gateCount', v)} step={1} />
                  <NumberField label="Ancho (m)" value={form.gateWidth} onChange={(v) => set('gateWidth', v)} />
                  <NumberField label="Alto (m)" value={form.gateHeight} onChange={(v) => set('gateHeight', v)} />
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <NumberField label="Ventanas" value={form.windowsCount} onChange={(v) => set('windowsCount', v)} step={1} />
                <NumberField label="Ancho ventana" value={form.windowWidth} onChange={(v) => set('windowWidth', v)} />
                <NumberField label="Alto ventana" value={form.windowHeight} onChange={(v) => set('windowHeight', v)} />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <Toggle label="Incluir fundación corrida" checked={form.includeFoundation} onChange={(v) => set('includeFoundation', v)} />
              {form.includeFoundation && (
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="Ancho fundación (m)" value={form.foundationWidth} onChange={(v) => set('foundationWidth', v)} />
                  <NumberField label="Profundidad (m)" value={form.foundationDepth} onChange={(v) => set('foundationDepth', v)} />
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <Toggle label="Incluir columnas / pilastras" checked={form.includeColumns} onChange={(v) => set('includeColumns', v)} />
              {form.includeColumns && (
                <NumberField label="Separación entre columnas (m)" value={form.columnSpacing} onChange={(v) => set('columnSpacing', v)} />
              )}
              <Toggle label="Incluir acero de refuerzo" checked={form.includeRebar} onChange={(v) => set('includeRebar', v)} />
              {form.includeRebar && (
                <details className="rounded-lg border border-amber-200 bg-white/60 p-2">
                  <summary className="cursor-pointer text-[11px] font-bold text-amber-900">Despiece de acero</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <NumberField label="Barras fundación" value={form.foundationBarCount} onChange={(v) => set('foundationBarCount', v)} step={1} />
                    <NumberField label="Ø fundación (mm)" value={form.foundationBarDiameter} onChange={(v) => set('foundationBarDiameter', v)} step={2} />
                    <NumberField label="Estribo fund. (m)" value={form.foundationStirrupSpacing} onChange={(v) => set('foundationStirrupSpacing', v)} step={0.05} />
                    <NumberField label="Ø estribo fund. (mm)" value={form.foundationStirrupDiameter} onChange={(v) => set('foundationStirrupDiameter', v)} step={2} />
                    <NumberField label="Barras columna" value={form.columnBarCount} onChange={(v) => set('columnBarCount', v)} step={1} />
                    <NumberField label="Ø columna (mm)" value={form.columnBarDiameter} onChange={(v) => set('columnBarDiameter', v)} step={2} />
                    <NumberField label="Estribo col. (m)" value={form.columnStirrupSpacing} onChange={(v) => set('columnStirrupSpacing', v)} step={0.05} />
                    <NumberField label="Ø estribo col. (mm)" value={form.columnStirrupDiameter} onChange={(v) => set('columnStirrupDiameter', v)} step={2} />
                  </div>
                </details>
              )}
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-amber-900">Friso</span>
              <select
                value={form.frisoSides}
                onChange={(e) => set('frisoSides', Number(e.target.value))}
                className="w-full rounded-xl border-2 border-amber-300 bg-amber-50/30 px-3 py-2 text-sm font-semibold text-amber-950 focus:border-amber-500 focus:outline-none"
              >
                <option value={0}>Sin friso</option>
                <option value={1}>Una cara</option>
                <option value={2}>Dos caras</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <Toggle label="Pintura" checked={form.includePaint} onChange={(v) => set('includePaint', v)} />
              <Toggle label="Concertina" checked={form.includeConcertina} onChange={(v) => set('includeConcertina', v)} />
              <Toggle label="Cerco eléctrico" checked={form.includeElectricFence} onChange={(v) => set('includeElectricFence', v)} />
              <Toggle label="Portón" checked={form.includeGate} onChange={(v) => set('includeGate', v)} />
            </div>
          </section>

          <section className="min-h-0 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/30">
            <div className="flex items-center justify-between border-b border-amber-200 px-4 py-3">
              <div>
                <h4 className="text-sm font-bold text-amber-950">Cómputo en cascada</h4>
                <p className="text-[11px] text-amber-800">
                  {preview.totals.area} m2 netos · {preview.totals.blocks} bloques · {preview.totals.concrete} m3 concreto · {preview.totals.rebar} kg acero
                </p>
                <p className="text-[10px] text-amber-700">
                  Área bruta {preview.totals.grossArea} m2 − huecos {preview.totals.openings} m2
                </p>
              </div>
              <Calculator className="h-5 w-5 text-amber-600" />
            </div>
            <div className="max-h-[52vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-amber-200 text-amber-950">
                  <tr>
                    <th className="px-2 py-2 text-left">Código</th>
                    <th className="px-2 py-2 text-left">Partida generada</th>
                    <th className="px-2 py-2 text-right">Cantidad</th>
                    <th className="px-2 py-2 text-center">Und</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-amber-200 bg-white/70">
                      <td className="px-2 py-2 align-top">
                        <input
                          type="text"
                          value={row.cod_par || ''}
                          onChange={(e) => setOverride(row.key, 'cod_par', e.target.value)}
                          placeholder="APU"
                          className="w-20 rounded border border-amber-300 px-1.5 py-1 text-[10px] font-mono"
                        />
                      </td>
                      <td className="px-2 py-2 text-amber-950">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => setOverride(row.key, 'description', e.target.value)}
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold hover:border-amber-300 focus:border-amber-500 focus:bg-white focus:outline-none"
                        />
                        <div className="px-1 text-[10px] text-amber-700">{row.formula}</div>
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-bold text-amber-950">{row.quantity.toLocaleString('es-VE', { maximumFractionDigits: 2 })}</td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => setOverride(row.key, 'unit', e.target.value)}
                          className="w-12 rounded border border-amber-300 px-1 py-1 text-center text-[10px] font-bold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-amber-200 px-4 py-2 text-[10px] text-amber-800">
              Puedes corregir código, descripción y unidad antes de incluir. Los huecos se descuentan del área de mampostería y acabados.
            </p>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-amber-200 bg-amber-50 px-4 py-3 sm:px-6">
          <span className="text-xs text-amber-800">{rows.length} partida(s) se agregarán a la planilla</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-amber-300 px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100">
              Cancelar
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!preview.rows.length || resolving}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {resolving ? 'Buscando APUs...' : 'Incluir en planilla'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
