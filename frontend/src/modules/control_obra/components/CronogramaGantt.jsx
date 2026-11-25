import React from 'react';
import { TrendingUp, Layers, CheckCircle2 } from 'lucide-react';

function money(val, currency = 'USD') {
  return `${currency === 'USD' ? '$' : 'Bs.'} ${Number(val || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(val) {
  return `${Number(val || 0).toFixed(2)}%`;
}

export default function CronogramaGantt({
  dataset,
  currency = 'USD',
  onItemWeekChange,
  readOnly = false,
}) {
  if (!dataset) return null;

  const {
    chapters = [],
    items = [],
    total_weeks = 13,
    weekly_totals = [],
    weekly_percents = [],
    curve_s_cumulative = [],
    month_ranges = [],
  } = dataset;

  const weeks = Array.from({ length: total_weeks }, (_, i) => i + 1);

  // SVG Curva S coordinates calculation
  const svgWidth = 800;
  const svgHeight = 180;
  const paddingX = 40;
  const paddingY = 25;

  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  const points = curve_s_cumulative.map((val, idx) => {
    const x = paddingX + (idx / Math.max(1, total_weeks - 1)) * chartW;
    const y = svgHeight - paddingY - (Math.min(100, Math.max(0, val)) / 100) * chartH;
    return { x, y, val };
  });

  const pathD = points.length > 0
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  return (
    <div className="space-y-6">
      {/* SECCIÓN 1: CURVA S EJECUTIVA */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Curva S Programada (Desembolso & Avance Acumulado)</h3>
              <p className="text-xs text-slate-500">
                Evolución porcentual acumulada a lo largo de las {total_weeks} semanas del proyecto
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-3.5 h-1 bg-amber-500 rounded-full inline-block" /> Curva S Programada
            </span>
            <span className="text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
              Total Presupuesto: <strong>{money(dataset.total_budget_amount, currency)}</strong>
            </span>
          </div>
        </div>

        {/* Gráfico SVG Curva S */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[650px] relative">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-44 overflow-visible">
              <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Guías horizontales 25%, 50%, 75%, 100% */}
              {[25, 50, 75, 100].map(level => {
                const y = svgHeight - paddingY - (level / 100) * chartH;
                return (
                  <g key={level}>
                    <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
                    <text x={paddingX - 8} y={y + 3} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">
                      {level}%
                    </text>
                  </g>
                );
              })}

              {/* Área y Línea Curva S */}
              {areaD && <path d={areaD} fill="url(#curveGradient)" />}
              {pathD && <path d={pathD} fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />}

              {/* Puntos y Etiquetas Semanales */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="3.5" fill="#D97706" stroke="#FFFFFF" strokeWidth="1.5" />
                  <text
                    x={p.x}
                    y={svgHeight - 6}
                    textAnchor="middle"
                    className="text-[9px] fill-slate-500 font-semibold"
                  >
                    S{idx + 1}
                  </text>
                  {/* Etiqueta flotante cada 2 o 3 semanas o última */}
                  {(idx % 2 === 0 || idx === points.length - 1) && (
                    <text
                      x={p.x}
                      y={p.y - 8}
                      textAnchor="middle"
                      className="text-[9px] fill-amber-800 font-bold font-mono"
                    >
                      {p.val.toFixed(1)}%
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: GANTT EJECUTIVO POR CAPÍTULOS */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Cronograma de Ejecución y Barras Gantt</h3>
          </div>
          <span className="text-xs text-slate-500">
            {chapters.length} Capítulos · {items.length} Partidas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-700 text-white font-semibold">
                <th className="px-3 py-2 text-center w-12 border-r border-slate-600">N°</th>
                <th className="px-3 py-2 text-left min-w-[240px] border-r border-slate-600">Capítulo / Partida</th>
                <th className="px-3 py-2 text-right w-24 border-r border-slate-600">Monto</th>
                <th className="px-3 py-2 text-right w-16 border-r border-slate-600">Peso %</th>
                <th className="px-2 py-2 text-center w-20 border-r border-slate-600">Semanas</th>
                {weeks.map(w => (
                  <th key={w} className="px-1 py-2 text-center w-12 border-r border-slate-600 font-mono">
                    S{w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chapters.map((chap, cIdx) => (
                <React.Fragment key={chap.name}>
                  {/* Fila Encabezado de Capítulo */}
                  <tr className="bg-slate-100 font-bold border-b border-slate-200 text-slate-800">
                    <td className="px-3 py-2 text-center border-r border-slate-200">{chap.num}</td>
                    <td className="px-3 py-2 border-r border-slate-200 text-slate-900">
                      {chap.name} ({chap.item_count} partidas)
                    </td>
                    <td className="px-3 py-2 text-right font-mono border-r border-slate-200">
                      {money(chap.amount, currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono border-r border-slate-200">
                      {pct(chap.weight_percent)}
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-[11px] text-blue-700 border-r border-slate-200">
                      S{chap.start_week}–S{chap.end_week}
                    </td>
                    {/* Barra Gantt de Capítulo */}
                    {weeks.map(w => {
                      const isActive = w >= chap.start_week && w <= chap.end_week;
                      return (
                        <td
                          key={w}
                          className={`p-1 text-center border-r border-slate-200 transition-colors ${
                            isActive ? 'bg-blue-600/20' : 'bg-transparent'
                          }`}
                        >
                          {isActive && (
                            <div className="h-4 w-full bg-blue-600 rounded-xs flex items-center justify-center shadow-2xs">
                              <span className="text-[9px] font-bold text-white leading-none">✓</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Partidas individuales del Capítulo */}
                  {items
                    .filter(it => it.chapter === chap.name)
                    .map(it => (
                      <tr key={it.item_id || it.num} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-3 py-1.5 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100">
                          {it.num}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700 truncate max-w-[280px] border-r border-slate-100" title={it.description}>
                          <span className="font-semibold text-slate-800 mr-1.5">[{it.code}]</span>
                          {it.description}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-600 border-r border-slate-100">
                          {money(it.total_amount, currency)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-500 border-r border-slate-100">
                          {pct(it.weight_percent)}
                        </td>
                        <td className="px-2 py-1.5 text-center border-r border-slate-100">
                          {!readOnly && onItemWeekChange ? (
                            <div className="flex items-center justify-center gap-1">
                              <select
                                value={it.start_week}
                                onChange={e => onItemWeekChange(it.item_id, Number(e.target.value), it.end_week)}
                                className="text-[10px] py-0.5 px-1 border border-slate-300 rounded bg-white text-slate-700"
                              >
                                {weeks.map(w => (
                                  <option key={w} value={w}>S{w}</option>
                                ))}
                              </select>
                              <span className="text-slate-400">-</span>
                              <select
                                value={it.end_week}
                                onChange={e => onItemWeekChange(it.item_id, it.start_week, Number(e.target.value))}
                                className="text-[10px] py-0.5 px-1 border border-slate-300 rounded bg-white text-slate-700"
                              >
                                {weeks.filter(w => w >= it.start_week).map(w => (
                                  <option key={w} value={w}>S{w}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-600">
                              S{it.start_week}–S{it.end_week}
                            </span>
                          )}
                        </td>
                        {/* Barras de Partida */}
                        {weeks.map(w => {
                          const isPartidaActive = w >= it.start_week && w <= it.end_week;
                          const wAmt = it.weekly_amounts ? it.weekly_amounts[w - 1] : 0;
                          return (
                            <td
                              key={w}
                              className={`p-1 text-center border-r border-slate-100 ${
                                isPartidaActive ? 'bg-amber-50/50' : ''
                              }`}
                            >
                              {isPartidaActive && (
                                <div
                                  className="h-3 w-full bg-amber-500/80 rounded-xs"
                                  title={`${money(wAmt, currency)}`}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </React.Fragment>
              ))}

              {/* PIE DE TABLA: INVERSIÓN SEMANAL */}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td colSpan={2} className="px-3 py-2 text-right border-r border-slate-200">
                  INVERSIÓN SEMANAL ($)
                </td>
                <td className="px-3 py-2 text-right font-mono border-r border-slate-200">
                  {money(dataset.total_budget_amount, currency)}
                </td>
                <td className="px-3 py-2 text-right font-mono border-r border-slate-200">
                  100.00%
                </td>
                <td className="border-r border-slate-200" />
                {weekly_totals.map((wTot, idx) => (
                  <td key={idx} className="px-1 py-2 text-right font-mono text-[10px] text-slate-800 border-r border-slate-200">
                    {Number(wTot).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                  </td>
                ))}
              </tr>

              {/* % SEMANAL */}
              <tr className="bg-slate-50 font-semibold border-b border-slate-200">
                <td colSpan={2} className="px-3 py-1.5 text-right text-slate-600 border-r border-slate-200">
                  % SEMANAL PROGRAMADO
                </td>
                <td className="border-r border-slate-200" />
                <td className="border-r border-slate-200" />
                <td className="border-r border-slate-200" />
                {weekly_percents.map((wp, idx) => (
                  <td key={idx} className="px-1 py-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-200">
                    {pct(wp)}
                  </td>
                ))}
              </tr>

              {/* CURVA S ACUMULADA */}
              <tr className="bg-amber-100/70 font-bold border-b-2 border-amber-300">
                <td colSpan={2} className="px-3 py-2 text-right text-amber-900 border-r border-amber-200">
                  CURVA S (AVANCE PROGRAMADO ACUMULADO)
                </td>
                <td className="border-r border-amber-200" />
                <td className="px-3 py-2 text-right font-mono text-amber-900 border-r border-amber-200">
                  100.00%
                </td>
                <td className="border-r border-amber-200" />
                {curve_s_cumulative.map((csVal, idx) => (
                  <td key={idx} className="px-1 py-2 text-center font-mono text-[10px] text-amber-900 border-r border-amber-200">
                    {pct(csVal)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
