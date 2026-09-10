import React from 'react';
import { createPortal } from 'react-dom';

export function APUPrintSheet({ partida, materiales = [], equipos = [], mano_obra = [], options = {} }) {
  if (!partida) return null;

  const exRate = (options?.currency === 'BS' || options?.currency === 'Bs' || options?.currency === 'Bs.') 
    ? (parseFloat(options?.exchange_rate ?? partida.exchange_rate) || 1.0) 
    : 1.0;
  const matInflation = parseFloat(options?.material_inflation ?? partida.material_inflation ?? 0) || 0;
  const eqInflation = parseFloat(options?.equipment_inflation ?? partida.equipment_inflation ?? 0) || 0;
  const labInflation = parseFloat(options?.labor_inflation ?? partida.labor_inflation ?? 0) || 0;
  const defaultLaborBonus = parseFloat(options?.labor_bonus ?? partida.labor_bonus ?? 0) || 0;

  const rendimiento = partida.RenPar || partida.rendimiento || partida.performance || 1;
  const adminPercent = options?.admin_percent ?? partida.admin_percent ?? partida.settings?.admin_percent ?? 15;
  const utilPercent = options?.profit_percent ?? options?.util_percent ?? partida.profit_percent ?? partida.util_percent ?? partida.settings?.profit_percent ?? 10;
  const fcasPercent = options?.fcas_percent ?? partida.fcas_percent ?? partida.settings?.fcas_percent ?? 417;
  const fcasFactor = fcasPercent / 100;

  const calcMatTotal = () => materiales.reduce((acc, m) => {
    const q = parseFloat(m.cantidad ?? m.quantity ?? 0);
    const p = (parseFloat(m.precio_unitario ?? m.price ?? 0) * exRate) * (1 + (matInflation / 100));
    const w = parseFloat(m.desperdicio ?? m.waste ?? 0);
    return acc + (m.subtotal ?? (q * p * (1 + w / 100)));
  }, 0);

  const calcEqTotal = () => equipos.reduce((acc, eq) => {
    const q = parseFloat(eq.cantidad ?? eq.quantity ?? 0);
    const d = parseFloat(eq.depreciacion ?? eq.depreciation ?? 1);
    const p = (parseFloat(eq.precio_unitario ?? eq.price ?? 0) * exRate) * (1 + (eqInflation / 100));
    return acc + (eq.subtotal ?? (q * d * p));
  }, 0);

  const calcLabTotalJornalDay = () => mano_obra.reduce((acc, lab) => {
    const q = parseFloat(lab.cantidad ?? lab.quantity ?? 0);
    const j = (parseFloat(lab.jornal ?? 0) * exRate) * (1 + (labInflation / 100));
    return acc + (lab.tot_jornal ?? (q * j));
  }, 0);

  const calcLabTotalBonoDay = () => mano_obra.reduce((acc, lab) => {
    const q = parseFloat(lab.cantidad ?? lab.quantity ?? 0);
    const bBonus = parseFloat(lab.bono) || defaultLaborBonus;
    const b = (bBonus * exRate) * (1 + (labInflation / 100));
    return acc + (q * b);
  }, 0);

  const calcLabTotalDay = () => calcLabTotalJornalDay() * (1 + fcasFactor) + calcLabTotalBonoDay();

  const totalMat = calcMatTotal();
  const totalEq = calcEqTotal() / rendimiento;
  const totalLab = calcLabTotalDay() / rendimiento;
  const subtotalA = totalMat + totalEq + totalLab;
  const adminCost = subtotalA * (adminPercent / 100);
  const subtotalB = subtotalA + adminCost;
  const utilCost = subtotalB * (utilPercent / 100);
  const subtotalC = subtotalB + utilCost;
  const unitPrice = subtotalC;

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
  const currencyDisplay = (options?.currency === 'BS' || options?.currency === 'Bs' || options?.currency === 'Bs.') ? 'Bs.' : (options?.currency || 'USD');

  return (
    <div className="apu-sheet-inner" style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Título principal */}
      <h1 className="text-center text-lg font-bold uppercase tracking-wide mb-4 mt-2">
        Análisis de Precio Unitario
      </h1>

      {/* Encabezado sin líneas divisorias, con etiquetas y valores juntos */}
      <div style={{ width: '100%', fontSize: '11px', marginBottom: '14px', lineHeight: '1.5', color: '#000' }}>
        {showCompany && (
          <div style={{ marginBottom: '2px' }}>
            <span style={{ fontWeight: 'bold' }}>Empresa: </span>
            <span style={{ textTransform: 'uppercase' }}>{companyName}</span>
          </div>
        )}
        <div style={{ marginBottom: '2px' }}>
          <span style={{ fontWeight: 'bold' }}>Obra: </span>
          <span style={{ textTransform: 'uppercase' }}>{obra}</span>
        </div>
        <div style={{ marginBottom: '2px' }}>
          <span style={{ fontWeight: 'bold' }}>Contratante: </span>
          <span style={{ textTransform: 'uppercase' }}>{contratante}</span>
        </div>
        <div style={{ marginBottom: '2px' }}>
          <span style={{ fontWeight: 'bold' }}>Descripción: </span>
          <span style={{ textTransform: 'uppercase' }}>{partida.Descri ?? partida.descripcion ?? partida.description ?? ''}</span>
        </div>
        <div style={{ display: 'flex', marginBottom: '2px' }}>
          <div style={{ width: '50%' }}>
            <span style={{ fontWeight: 'bold' }}>Unidad: </span>
            <span style={{ textTransform: 'uppercase' }}>{partida.UniPar ?? partida.unidad ?? partida.unit ?? ''}</span>
          </div>
          <div style={{ width: '50%' }}>
            <span style={{ fontWeight: 'bold' }}>Cantidad: </span>
            <span>{numFormat(partida.CanPar ?? partida.cantidad ?? partida.quantity ?? 1)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', marginBottom: '2px' }}>
          <div style={{ width: '50%' }}>
            <span style={{ fontWeight: 'bold' }}>Rendimiento: </span>
            <span>{numFormat(rendimiento)}</span>
          </div>
          <div style={{ width: '50%' }}>
            <span style={{ fontWeight: 'bold' }}>Código: </span>
            <span>{codigoCovenin}</span>
          </div>
        </div>
        {dateStr && (
          <div style={{ marginBottom: '2px' }}>
            <span style={{ fontWeight: 'bold' }}>Fecha: </span>
            <span>{dateStr}</span>
          </div>
        )}
      </div>

      {/* 1. MATERIALES */}
      <div className="mb-4">
        <h2 className="font-bold text-[11px] mb-1">1. MATERIALES</h2>
        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-black px-1 py-1 text-center font-bold w-8">Nº</th>
              <th className="border border-black px-1 py-1 text-left font-bold w-auto">Descripción</th>
              <th className="border border-black px-1 py-1 text-center font-bold w-10">Und.</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Cantidad</th>
              <th className="border border-black px-1 py-1 text-right font-bold w-12">Desp%</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Precio</th>
              <th className="border border-black px-1 py-1 text-right font-bold">Total Material</th>
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
                </tr>
              );
            })}
            <tr className="font-bold">
              <td className="border border-black px-1 py-1 text-right bg-gray-50" colSpan={6}>
                Total Materiales
              </td>
              <td className="border border-black px-1 py-1 text-right">{numFormat(totalMat)}</td>
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
                  <td className="border border-black px-1 py-0.5 text-right bg-gray-50">{numFormat(sub / rendimiento)}</td>
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
                  <td className="border border-black px-1 py-0.5 text-right bg-gray-50">{numFormat((tj + tb) / rendimiento)}</td>
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
                FCAS: {numFormat(fcasPercent)} %
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
        <table className="border-collapse border border-black text-[11px] w-[380px]">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1 text-right font-bold w-52 bg-gray-50">Costo Directo SubTotal A:</td>
              <td className="border border-black px-2 py-1 text-right w-32 font-bold">{numFormat(subtotalA)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 text-right bg-gray-50">{numFormat(adminPercent)}% Administración y Gastos Generales:</td>
              <td className="border border-black px-2 py-1 text-right">{numFormat(adminCost)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 text-right font-bold bg-gray-50">SubTotal B:</td>
              <td className="border border-black px-2 py-1 text-right font-bold">{numFormat(subtotalB)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 text-right bg-gray-50">{numFormat(utilPercent)}% Imprevisto Utilidad:</td>
              <td className="border border-black px-2 py-1 text-right">{numFormat(utilCost)}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1 text-right font-bold bg-gray-50">SubTotal C:</td>
              <td className="border border-black px-2 py-1 text-right font-bold">{numFormat(subtotalC)}</td>
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

export default function PrintAPULayout({ partida, materiales, equipos, mano_obra, options }) {
  if (!partida) return null;

  return createPortal(
    <div
      id="print-apu-layout"
      className="print-only"
      style={{
        display: 'none',
        backgroundColor: '#fff',
        color: '#000',
        fontFamily: 'Arial, sans-serif',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <APUPrintSheet
        partida={partida}
        materiales={materiales}
        equipos={equipos}
        mano_obra={mano_obra}
        options={options}
      />
    </div>,
    document.body
  );
}
