import React from 'react';

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

  const obra = options?.obra ?? partida.obra ?? 'C/S/C';
  const contratante = options?.contratante ?? partida.contratante ?? 'C/S/C';

  return (
    <div className="hidden print:block w-full bg-white text-black font-sans text-[11px] leading-tight print-apu-container">
      {/* Título principal */}
      <h1 className="text-center text-lg font-bold uppercase tracking-wide mb-4 mt-2">
        Análisis de Precio Unitario
      </h1>

      {/* Encabezado estilo Excel */}
      <table className="w-full border-collapse border border-black text-[11px] mb-4">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1 font-bold w-[15%] bg-gray-50">Obra:</td>
            <td className="border border-black px-2 py-1 uppercase" colSpan={3}>{obra}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-bold bg-gray-50">Contratante:</td>
            <td className="border border-black px-2 py-1 uppercase" colSpan={3}>{contratante}</td>
          </tr>
          <tr>
            {/* Se combina la celda de descripción con rowSpan para emular la celda C6 y la de abajo */}
            <td className="border border-black px-2 py-1 font-bold bg-gray-50" rowSpan={2}>Descripción:</td>
            <td className="border border-black px-2 py-1 uppercase align-top" rowSpan={2} colSpan={3}>
              {partida.Descri ?? partida.descripcion ?? partida.description ?? ''}
            </td>
          </tr>
          <tr></tr>
          <tr>
            <td className="border border-black px-2 py-1 font-bold bg-gray-50">Unidad:</td>
            <td className="border border-black px-2 py-1 uppercase w-[35%]">{partida.UniPar ?? partida.unidad ?? partida.unit ?? ''}</td>
            <td className="border border-black px-2 py-1 font-bold w-[15%] bg-gray-50">Cantidad:</td>
            <td className="border border-black px-2 py-1 w-[35%]">{numFormat(partida.CanPar ?? partida.cantidad ?? partida.quantity ?? 1)}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-bold bg-gray-50">Rendimiento:</td>
            <td className="border border-black px-2 py-1">{numFormat(rendimiento)}</td>
            <td className="border border-black px-2 py-1 font-bold bg-gray-50">Código:</td>
            <td className="border border-black px-2 py-1">{partida.CovPar ?? partida.CodPar ?? partida.codigo ?? partida.code ?? 'C/S/C'}</td>
          </tr>
        </tbody>
      </table>

      {/* 1. MATERIALES */}
      <div className="mb-4">
        <h2 className="font-bold text-[11px] mb-1">1. MATERIALES</h2>
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-black px-1 py-1 text-center font-bold w-6">Nº</th>
              {/* Columna B con ancho asegurado para que lea "Descripción" */}
              <th className="border border-black px-1 py-1 text-left font-bold w-[40%]">Descripción</th>
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
              <th className="border border-black px-1 py-1 text-center font-bold w-6">Nº</th>
              {/* Columna B con ancho asegurado */}
              <th className="border border-black px-1 py-1 text-left font-bold w-[40%]">Descripción</th>
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
              <th className="border border-black px-1 py-1 text-center font-bold w-6">Nº</th>
              {/* Columna B con ancho asegurado */}
              <th className="border border-black px-1 py-1 text-left font-bold w-[40%]">Descripción</th>
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
    </div>
  );
}
