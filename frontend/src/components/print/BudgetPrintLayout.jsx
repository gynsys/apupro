import React from 'react';
import { createPortal } from 'react-dom';
import { calculateItemPU } from '../../utils/apuCalculations';
import { APUPrintSheet } from '../PrintAPULayout';

export default function BudgetPrintLayout({ budget, config }) {
  if (!budget) return null;

  const calculatePU = (item) => calculateItemPU(item, {
    ...budget,
    currency: config?.currency || budget?.currency
  });

  // Build the list of rows to render.
  const rows = [];
  let currentChapter = null;
  let currentChapterSubtotal = 0;
  let itemIndex = 1;

  const items = budget.items || [];

  // Filtrar capítulos según la configuración
  const shouldIncludeChapters = config.type === 'capitulos';

  // Declarar ANTES del forEach para evitar Temporal Dead Zone
  const currencyDisplay = (config?.currency === 'BS' || config?.currency === 'Bs' || config?.currency === 'Bs.') ? 'Bs.' : (config?.currency || 'USD');
  const currencyHeader = currencyDisplay.endsWith('.') ? currencyDisplay : `${currencyDisplay}.`;

  items.forEach((item) => {
    if (item.is_chapter) {
      if (shouldIncludeChapters) {
        if (currentChapter) {
          rows.push({
            type: 'chapter-subtotal',
            chapterId: currentChapter.id,
            chapterName: currentChapter.description,
            amount: currentChapterSubtotal
          });
        }
        currentChapter = item;
        currentChapterSubtotal = 0;
        rows.push({ type: 'chapter', ...item });
      } else {
        currentChapter = null;
        currentChapterSubtotal = 0;
      }
    } else {
      const pu = calculatePU(item);
      const total = pu * item.quantity;

      if (shouldIncludeChapters && currentChapter) {
        currentChapterSubtotal += total;
      }

      rows.push({
        type: 'item',
        ...item,
        pu,
        total,
        partNumber: itemIndex++
      });
    }
  });

  const ivaPercent = budget.iva_percent !== undefined && budget.iva_percent !== null ? Number(budget.iva_percent) : 16;

  if (shouldIncludeChapters && currentChapter) {
    rows.push({
      type: 'chapter-subtotal',
      chapterId: currentChapter.id,
      chapterName: currentChapter.description,
      amount: currentChapterSubtotal
    });
  }

  const subtotalPresupuesto = items.filter(i => !i.is_chapter).reduce((sum, i) => sum + (calculatePU(i) * i.quantity), 0);
  const ivaAmount = subtotalPresupuesto * (ivaPercent / 100);
  const totalGeneral = subtotalPresupuesto + (config.includeIva ? ivaAmount : 0);

  const formatCurrency = (val) => Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const obra        = (budget.project_name || budget.name || '').trim();
  const ubicacion   = (config?.ubicacion || budget.ubicacion || budget.location || localStorage.getItem(`budget_ubicacion_${budget.id}`) || '').trim();
  const contratante = (budget.client_name || config?.contratante || '').trim();
  const companyName = (budget.company_name || '').trim();

  return createPortal(
    <div
      id="print-budget-layout"
      className="print-only"
      style={{
        display: 'none',
        backgroundColor: '#fff',
        color: '#000',
        fontFamily: 'Arial, sans-serif',
        width: '100%',
        boxSizing: 'border-box',
        padding: '12mm 15mm'
      }}
    >
      <div style={{ width: '100%', boxSizing: 'border-box' }}>

        {/* ── ENCABEZADO (estilo PDF: empresa top-left, sin membrete derecho) ── */}
        <div style={{ marginBottom: '14px' }}>

          {/* Logo si se incluye — tamaño controlado para que se renderice completo */}
          {config.includeLogo && (() => {
            const savedLogo = localStorage.getItem(`budget_logo_${budget.id}`);
            const logoSrc = savedLogo || '/images/logo_aeko360.png';
            return (
              <img
                src={logoSrc}
                alt="Logo Empresa"
                style={{
                  maxWidth: '160px',
                  maxHeight: '70px',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                  marginBottom: '6px',
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            );
          })()}

          {/* Nombre de empresa — grande y bold, alineado a la izquierda */}
          {companyName && (
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '6px' }}>
              {companyName}
            </div>
          )}

          {/* Obra */}
          {obra && (
            <p style={{ margin: '2px 0', fontSize: '11px' }}>
              <strong>Obra:</strong> {obra}
            </p>
          )}

          {/* Contratante */}
          {contratante && (
            <p style={{ margin: '2px 0', fontSize: '11px' }}>
              <strong>Contratante:</strong> {contratante}
            </p>
          )}

          {/* Ubicación */}
          {ubicacion && (
            <p style={{ margin: '2px 0', fontSize: '11px' }}>
              <strong>Ubicación:</strong> {ubicacion}
            </p>
          )}

          {/* RIF */}
          {config.includeRif && budget.company_rif && budget.company_rif.trim() && (
            <p style={{ margin: '2px 0', fontSize: '11px' }}>
              <strong>RIF:</strong> {budget.company_rif.trim()}
            </p>
          )}
        </div>

        {/* Título centrado con letras espaciadas */}
        <h2 style={{ textAlign: 'center', letterSpacing: '8px', margin: '0 0 14px 0', fontSize: '18px', fontWeight: 'bold' }}>
          {config.title || 'PRESUPUESTO'}
        </h2>

        {/* ── TABLA DE PRESUPUESTO ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', borderBottom: '1px solid #000', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '45px' }}>Part. No</th>
              <th style={{ ...thStyle, width: 'auto' }}>Descripción</th>
              <th style={{ ...thStyle, width: '45px' }}>Und.</th>
              <th style={{ ...thStyle, width: '75px' }}>Cantidad</th>
              <th style={{ ...thStyle, width: '90px' }}>Precio Unitario</th>
              <th style={{ ...thStyle, width: '125px' }}>Total {currencyHeader}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {

              /* ── CAPÍTULO ──
                 Celdas individuales por columna para que las líneas verticales
                 sean continuas. El nombre va en la columna Descripción. */
              if (row.type === 'chapter') {
                return (
                  <tr key={`cap-${row.id}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td style={{ ...tdStyle, borderLeft: '1px solid #000', width: '45px', paddingTop: '10px', paddingBottom: '2px' }} />
                    <td style={{ ...tdStyle, fontWeight: 'bold', paddingTop: '10px', paddingBottom: '2px', fontSize: '11px', textTransform: 'uppercase' }}>
                      {row.description}
                    </td>
                    <td style={{ ...tdStyle, width: '45px', paddingTop: '10px', paddingBottom: '2px' }} />
                    <td style={{ ...tdStyle, width: '75px', paddingTop: '10px', paddingBottom: '2px' }} />
                    <td style={{ ...tdStyle, width: '90px', paddingTop: '10px', paddingBottom: '2px' }} />
                    <td style={{ ...tdStyle, borderRight: '1px solid #000', width: '125px', paddingTop: '10px', paddingBottom: '2px' }} />
                  </tr>
                );
              }

              /* ── SUBTOTAL DE CAPÍTULO ──
                 Celdas individuales: Part.No vacío | label (colSpan=4) | monto.
                 Se mantiene la línea entre Part.No y Descripción, y entre PU y Total. */
              if (row.type === 'chapter-subtotal') {
                return (
                  <tr key={`sub-${row.chapterId}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    {/* Celda Part.No — vacía, mantiene su línea derecha */}
                    <td style={{
                      ...tdStyle,
                      borderLeft: '1px solid #000',
                      borderBottom: '1px solid #000',
                      width: '45px',
                      paddingTop: '4px',
                      paddingBottom: '10px',
                    }} />
                    {/* Label spanning Descripción + Und. + Cantidad + PU */}
                    <td
                      colSpan={4}
                      style={{
                        ...tdStyle,
                        borderBottom: '1px solid #000',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        fontStyle: 'italic',
                        paddingTop: '4px',
                        paddingBottom: '10px',
                      }}
                    >
                      Total {currencyHeader}&nbsp;&nbsp;{row.chapterName}:
                    </td>
                    {/* Monto */}
                    <td style={{
                      ...tdStyle,
                      borderRight: '1px solid #000',
                      borderBottom: '1px solid #000',
                      fontWeight: 'bold',
                      textAlign: 'right',
                      paddingTop: '4px',
                      paddingBottom: '10px',
                      width: '125px',
                    }}>
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                );
              }

              /* ── PARTIDA NORMAL ── */
              return (
                <tr key={`item-${row.id}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'top', width: '45px' }}>
                    {row.partNumber}
                  </td>
                  <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                    {/* Código bold en su propia línea, con separación visible antes de la descripción */}
                    {(row.cov_par || row.cod_par) && (
                      <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '4px' }}>
                        {row.cov_par || row.cod_par}
                      </div>
                    )}
                    <div>{row.description}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'top', width: '45px' }}>
                    {row.unit}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', verticalAlign: 'top', width: '75px' }}>
                    {formatCurrency(row.quantity)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', verticalAlign: 'top', width: '90px' }}>
                    {formatCurrency(row.pu)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', verticalAlign: 'top', width: '125px' }}>
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── PIE: NOTAS + TOTALES ── */}
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '11px', width: '100%', boxSizing: 'border-box' }}>

          {budget.notes && budget.notes.trim() !== '' ? (
            <div style={{ flex: 1, marginRight: '20px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '6px 10px', fontSize: '10px', backgroundColor: '#fff' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px', textTransform: 'uppercase', color: '#111827', fontSize: '10px' }}>Nota:</div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#374151', lineHeight: '1.4' }}>{budget.notes}</div>
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          <table style={{ borderCollapse: 'collapse', flexShrink: 0, marginLeft: 'auto', tableLayout: 'fixed' }}>
            <tbody>
              <tr>
                <td style={{ ...totalLabelStyle }}>Subtotal ({currencyDisplay}):</td>
                <td style={{ ...totalValueStyle }}>{formatCurrency(subtotalPresupuesto)}</td>
              </tr>
              {config.includeIva && (
                <tr>
                  <td style={{ ...totalLabelStyle }}>IVA {ivaPercent}% ({currencyDisplay}):</td>
                  <td style={{ ...totalValueStyle }}>{formatCurrency(ivaAmount)}</td>
                </tr>
              )}
              <tr>
                <td style={{ ...totalLabelStyle }}>Total Presupuesto ({currencyDisplay}):</td>
                <td style={{ ...totalValueStyle }}>{formatCurrency(totalGeneral)}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* ── APUs individuales si se seleccionó "Imprimir todos los APU" ── */}
      {config?.includeAllApus && (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
          {items.filter(i => !i.is_chapter).map((item, idx) => (
            <div
              key={`print-all-apu-${item.id || idx}`}
              style={{
                pageBreakBefore: 'always',
                breakBefore: 'page',
                paddingTop: '10mm',
                boxSizing: 'border-box'
              }}
            >
              <APUPrintSheet
                partida={{
                  ...item,
                  fcas_percent: budget.fcas_percent,
                  admin_percent: budget.admin_percent,
                  util_percent: budget.profit_percent,
                  rendimiento: item.performance ?? item.rendimiento ?? 1,
                  cantidad: item.quantity,
                  obra: obra,
                  contratante: contratante,
                  ubicacion: ubicacion,
                  company_name: budget.company_name || obra
                }}
                materiales={item.materials || []}
                equipos={item.equipments || []}
                mano_obra={item.labors || []}
                options={{
                  color: true,
                  format: 'lines',
                  showCompany: config.includeLogo,
                  companyName: budget.company_name || obra,
                  currency: config.currency || budget.currency,
                  exchange_rate: budget.exchange_rate,
                  material_inflation: budget.material_inflation,
                  equipment_inflation: budget.equipment_inflation,
                  labor_inflation: budget.labor_inflation,
                  admin_percent: budget.admin_percent,
                  profit_percent: budget.profit_percent,
                  fcas_percent: budget.fcas_percent,
                  obra: obra,
                  contratante: contratante,
                  dateType: 'current'
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

const thStyle = {
  border: '1px solid #000',
  padding: '4px 6px',
  textAlign: 'center',
  fontWeight: 'bold',
  backgroundColor: '#fff',
  boxSizing: 'border-box'
};

const tdStyle = {
  borderLeft: '1px solid #000',
  borderRight: '1px solid #000',
  borderBottom: 'none',
  borderTop: 'none',
  padding: '4px 6px',
  boxSizing: 'border-box'
};

const totalLabelStyle = {
  border: '1px solid #000',
  textAlign: 'right',
  padding: '4px 8px',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box'
};

const totalValueStyle = {
  border: '1px solid #000',
  padding: '4px 8px',
  textAlign: 'right',
  fontWeight: 'bold',
  width: '125px',
  boxSizing: 'border-box'
};
