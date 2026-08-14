import React from 'react';
import { createPortal } from 'react-dom';

export default function PrintAPULayout({ partida, materiales, equipos, mano_obra, options }) {
  if (!partida) return null;

  const rendimiento = partida.RenPar || partida.rendimiento || 1;
  const adminPercent = partida.admin_percent ?? 15;
  const utilPercent = partida.util_percent ?? 10;
  const fcasFactor = (partida.fcas_percent ?? 988) / 100;

  const calcMatTotal = () => materiales.reduce((acc, m) => {
    const q = parseFloat(m.cantidad ?? m.quantity ?? 0);
    const p = parseFloat(m.precio_unitario ?? m.price ?? 0);
    const w = parseFloat(m.desperdicio ?? m.waste ?? 0);
    return acc + (m.subtotal ?? (q * p * (1 + w / 100)));
  }, 0);

  const calcEqTotal = () => equipos.reduce((acc, eq) => {
    const q = parseFloat(eq.cantidad ?? eq.quantity ?? 0);
    const d = parseFloat(eq.depreciacion ?? eq.depreciation ?? 1);
    const p = parseFloat(eq.precio_unitario ?? eq.price ?? 0);
    return acc + (eq.subtotal ?? (q * d * p));
  }, 0);

  const calcLabTotalJornalDay = () => mano_obra.reduce((acc, lab) => {
    const q = parseFloat(lab.cantidad ?? lab.quantity ?? 0);
    const j = parseFloat(lab.jornal ?? 0);
    return acc + (lab.tot_jornal ?? (q * j));
  }, 0);

  const calcLabTotalBonoDay = () => mano_obra.reduce((acc, lab) => {
    const q = parseFloat(lab.cantidad ?? lab.quantity ?? 0);
    const b = parseFloat(lab.bono ?? 0);
    return acc + (lab.tot_bono ?? (q * b));
  }, 0);

  const calcLabTotalDay = () => calcLabTotalJornalDay() * (1 + fcasFactor) + calcLabTotalBonoDay();

  const totalMat = calcMatTotal();
  const totalEq = calcEqTotal() / rendimiento;
  const totalLab = calcLabTotalDay() / rendimiento;
  const subtotalA = totalMat + totalEq + totalLab;
  const adminCost = subtotalA * (adminPercent / 100);
  const subtotalB = subtotalA + adminCost;
  const utilCost = subtotalB * (utilPercent / 100);
  const unitPrice = subtotalB + utilCost;

  const numFormat = (val) => Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Opciones del modal
  const showColor    = options?.color !== false;     // default: true
  const showLines    = options?.format !== 'no-lines'; // default: true
  const showCompany  = options?.showCompany === true;
  const companyName  = options?.companyName ?? '';
  const dateType     = options?.dateType ?? 'none';
  const showManHours = options?.showManHours === true;

  // Fecha según opción
  const now = new Date();
  const dateStr = dateType === 'current'
    ? now.toLocaleDateString('es-VE')
    : (dateType === 'db' ? (partida.fecha ?? '') : '');

  // Código COVENIN: probar todas las variantes snake_case y PascalCase
  const codigoCovenin = partida.cov_par || partida.CovPar || partida.codigo_covenin || partida.CodPar || partida.codigo || '';

  // Obra y Contratante: en blanco si no viene
  const obra        = options?.obra        || partida.obra        || '';
  const contratante = options?.contratante || partida.contratante || '';

  // Colores condicionales
  const headerBg  = showColor ? '#e5e7eb' : '#ffffff';  // gray-200 o blanco
  const totalBg   = showColor ? '#dbeafe' : '#ffffff';  // blue-100 o blanco
  const border    = showLines ? '1px solid black' : '1px solid transparent';

  return createPortal(
    <div
      id="print-apu-layout"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: '210mm',
        backgroundColor: 'white',
        color: 'black',
        fontSize: '11px',
        lineHeight: '1.2',
        fontFamily: 'Arial, sans-serif',
        padding: '10mm',
        zIndex: -1,
      }}
    >
      {/* Título principal */}
      <h1 className="text-center text-lg font-bold uppercase tracking-wide mb-4 mt-2">
        Análisis de Precio Unitario
      </h1>

      {/* Encabezado estilo Excel */}
      <table className="w-full border-collapse text-[11px] mb-4" style={{ border }}>
        <tbody>
          {showCompany && (
            <tr>
              <td style={{ border, backgroundColor: headerBg }} className="px-2 py-1 font-bold w-[15%]">Empresa:</td>
              <td style={{ border }} className="px-2 py-1 uppercase" colSpan={3}>{companyName}</td>
            </tr>
          )}
          <tr>
            <td style={{ border, backgroundColor: headerBg }} className="px-2 py-1 font-bold w-[15%]">Obra:</td>
            <td style={{ border }} className="px-2 py-1 uppercase" colSpan={3}>{obra}</td>
          </tr>
          <tr>
            <td style={{ border, backgroundColor: headerBg }} className="px-2 py-1 font-bold">Contratante:</td>
            <td style={{ border }} className="px-2 py-1 uppercase" colSpan={3}>{contratante}</td>
          </tr>
          <tr>
            <td style={{ border, backgroundColor: headerBg }} className="px-2 py-1 font-bold" rowSpan={2}>Descripción:</td>
            <td style={{ border }} className="px-2 py-1 uppercase align-top" rowSpan={2} colSpan={3}>
              {partida.Descri ?? partida.descripcion ?? partida.description ?? ''}
            </td>
          </tr>
          <tr></tr>
          <tr>
            <td style={{ border, backgroundColor: headerBg }} className="px-2 py-1 font-bold">Unidad:</td>
            <td style={{ border }} className="px-2 py-1 uppercase w-[35%]">{partida.UniPar ?? partida.unidad ?? partida.unit ?? ''}</td>
            <td style={{ border, backgroundColor: headerBg }} className="px-2 py-1 font-bold w-[15%]">Cantidad:</td>
            <td style={{ border }} className="px-2 py-1 w-[35%]">{numFormat(partida.CanPar ?? partida.cantidad ?? partida.quantity ?? 1)}</td>
          </tr>
          <tr>
            <td style={{ border, backgroundColor: headerBg }} className="px-2 py-1 font-bold">Rendimiento:</td>
            <td style={{ border }} className="px-2 py-1">{numFormat(rendimiento)}</td>
            <td style={{ border, backgroundColor: headerBg }} className="px-2 py-1 font-bold">Código:</td>
            <td style={{ border }} className="px-2 py-1">{codigoCovenin}</td>
          </tr>
          {dateStr && (
            <tr>
              <td style={{ border, backgroundColor: headerBg }} className="px-2 py-1 font-bold">Fecha:</td>
              <td style={{ border }} className="px-2 py-1" colSpan={3}>{dateStr}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 1. MATERIALES */}
      <div className="mb-4">
        <h2 className="font-bold text-[11px] mb-1">1. MATERIALES</h2>
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-black px-1 py-1 text-center font-bold w-8">Nº</th>
              {/* Columna B ajustada a lo solicitado */}
              <th className="border border-black px-1 py-1 text-left font-bold w-auto">Descripción</th>
              <th className="border border-black px-1 py-1 text-center font-bold w-10">Und.</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Cantidad</th>
              <th className="border border-black px-1 py-1 text-right font-bold w-12">Desp%</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Precio</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Total Material</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Costo Unitario</th>
            </tr>
          </thead>
          <tbody>
            {materiales.map((m, i) => {
              const q = parseFloat(m.cantidad ?? m.quantity ?? 0);
              const p = parseFloat(m.precio_unitario ?? m.price ?? 0);
              const w = parseFloat(m.desperdicio ?? m.waste ?? 0);
              const sub = m.subtotal ?? (q * p * (1 + w / 100));
              return (
                <tr key={i}>
                  <td className="border border-black px-1 py-0.5 text-center">{i + 1}</td>
                  <td className="border border-black px-1 py-0.5 text-left uppercase">{m.descripcion ?? m.description ?? ''}</td>
                  <td className="border border-black px-1 py-0.5 text-center">{m.unidad ?? m.unit ?? ''}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(q)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(w)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(p)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(sub)}</td>
                  <td className="border border-black px-1 py-0.5 text-right bg-gray-50"></td>
                </tr>
              );
            })}
            <tr className="font-bold">
              <td className="border border-black px-1 py-1 text-right bg-gray-50" colSpan={6}>
                Total Materiales
              </td>
              <td className="border border-black px-1 py-1 text-right">{numFormat(totalMat)}</td>
              <td className="border border-black px-1 py-1 text-right bg-gray-100">{numFormat(totalMat)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. EQUIPOS */}
      <div className="mb-4">
        <h2 className="font-bold text-[11px] mb-1">2. EQUIPOS</h2>
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-black px-1 py-1 text-center font-bold w-8">Nº</th>
              {/* Columna B con ancho asegurado */}
              <th className="border border-black px-1 py-1 text-left font-bold w-auto">Descripción</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Cantidad</th>
              <th className="border border-black px-1 py-1 text-right font-bold">COP/Dep/Al</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Precio</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Total Equipo</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Costo Unitario</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((eq, i) => {
              const q = parseFloat(eq.cantidad ?? eq.quantity ?? 0);
              const d = parseFloat(eq.depreciacion ?? eq.depreciation ?? 1);
              const p = parseFloat(eq.precio_unitario ?? eq.price ?? 0);
              const sub = eq.subtotal ?? (q * d * p);
              return (
                <tr key={i}>
                  <td className="border border-black px-1 py-0.5 text-center">{i + 1}</td>
                  <td className="border border-black px-1 py-0.5 text-left uppercase">{eq.descripcion ?? eq.description ?? ''}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(q)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(d)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(p)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(sub)}</td>
                  <td className="border border-black px-1 py-0.5 text-right bg-gray-50"></td>
                </tr>
              );
            })}
            <tr className="font-bold">
              <td className="border border-black px-1 py-1 text-right bg-gray-50" colSpan={5}>
                Total Equipos
              </td>
              <td className="border border-black px-1 py-1 text-right">{numFormat(calcEqTotal())}</td>
              <td className="border border-black px-1 py-1 text-right bg-gray-100">{numFormat(totalEq)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 3. MANO DE OBRA */}
      <div className="mb-4">
        <h2 className="font-bold text-[11px] mb-1">3. MANO DE OBRA</h2>
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-black px-1 py-1 text-center font-bold w-8">Nº</th>
              {/* Columna B con ancho asegurado */}
              <th className="border border-black px-1 py-1 text-left font-bold w-auto">Descripción</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Cantidad</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Jornal</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Bono</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Total Bono</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Total Jornal</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Costo Unitario</th>
            </tr>
          </thead>
          <tbody>
            {mano_obra.map((lab, i) => {
              const q = parseFloat(lab.cantidad ?? lab.quantity ?? 0);
              const j = parseFloat(lab.jornal ?? 0);
              const b = parseFloat(lab.bono ?? 0);
              const tj = lab.tot_jornal ?? (q * j);
              const tb = lab.tot_bono ?? (q * b);
              return (
                <tr key={i}>
                  <td className="border border-black px-1 py-0.5 text-center">{i + 1}</td>
                  <td className="border border-black px-1 py-0.5 text-left uppercase">{lab.descripcion ?? lab.description ?? ''}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(q)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(j)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(b)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(tb)}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{numFormat(tj)}</td>
                  <td className="border border-black px-1 py-0.5 text-right bg-gray-50"></td>
                </tr>
              );
            })}
            {/* Subtotales */}
            <tr>
              <td className="border border-black px-1 py-0.5" colSpan={5}></td>
              <td className="border border-black px-1 py-0.5 text-right font-bold bg-gray-50">Sub Total Mano de Obra:</td>
              <td className="border border-black px-1 py-0.5 text-right font-bold">{numFormat(calcLabTotalBonoDay())}</td>
              <td className="border border-black px-1 py-0.5 text-right font-bold">{numFormat(calcLabTotalJornalDay())}</td>
            </tr>
            <tr>
              <td className="border border-black px-1 py-0.5" colSpan={3}></td>
              <td className="border border-black px-1 py-0.5 text-right font-bold bg-gray-50" colSpan={2}>
                FCAS: {numFormat(partida.fcas_percent ?? 988)} %
              </td>
              <td className="border border-black px-1 py-0.5 text-right font-bold bg-gray-50">Prestaciones Sociales:</td>
              <td className="border border-black px-1 py-0.5 text-right">{numFormat(calcLabTotalJornalDay() * fcasFactor)}</td>
              <td className="border border-black px-1 py-0.5 bg-gray-50"></td>
            </tr>
            <tr className="font-bold">
              <td className="border border-black px-1 py-1 text-right bg-gray-50" colSpan={6}>
                Total General Mano de Obra:
              </td>
              <td className="border border-black px-1 py-1 text-right">{numFormat(calcLabTotalDay())}</td>
              <td className="border border-black px-1 py-1 text-right bg-gray-100">{numFormat(totalLab)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Resumen de Costos (alineado a la derecha) */}
      <div className="flex justify-end mt-6">
        <table className="border-collapse border border-black text-[11px] w-[350px]">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1 text-right font-bold w-48 bg-gray-50">Costo Directo o SubTotal A:</td>
              <td className="border border-black px-2 py-1 text-right w-32 font-bold">{numFormat(subtotalA)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 text-right bg-gray-50">{numFormat(adminPercent)}% Administración e Imprevistos:</td>
              <td className="border border-black px-2 py-1 text-right">{numFormat(adminCost)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 text-right font-bold bg-gray-50">SubTotal B:</td>
              <td className="border border-black px-2 py-1 text-right font-bold">{numFormat(subtotalB)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 text-right bg-gray-50">{numFormat(utilPercent)}% Utilidad:</td>
              <td className="border border-black px-2 py-1 text-right">{numFormat(utilCost)}</td>
            </tr>
            <tr className="bg-blue-100">
              <td className="border border-black px-2 py-1 text-right font-bold uppercase text-[12px]">Precio Unitario:</td>
              <td className="border border-black px-2 py-1 text-right font-bold text-[12px]">{numFormat(unitPrice)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>,
    document.body
  );
}
