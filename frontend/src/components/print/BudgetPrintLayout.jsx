import React from 'react';
import { createPortal } from 'react-dom';
import { calculateItemPU } from '../../utils/apuCalculations';

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
  
  items.forEach((item, index) => {
    if (item.is_chapter) {
      if (shouldIncludeChapters) {
        if (currentChapter) {
          rows.push({
            type: 'chapter-subtotal',
            chapterId: currentChapter.id,
            description: `Total ${currencyHeader} ${currentChapter.description}:`,
            amount: currentChapterSubtotal
          });
        }
        currentChapter = item;
        currentChapterSubtotal = 0;
        
        rows.push({
          type: 'chapter',
          ...item
        });
      } else {
        // Si no incluir capítulos, resetear el capítulo actual
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

  const currencyDisplay = (config?.currency === 'BS' || config?.currency === 'Bs' || config?.currency === 'Bs.') ? 'Bs.' : (config?.currency || 'USD');
  const currencyHeader = currencyDisplay.endsWith('.') ? currencyDisplay : `${currencyDisplay}.`;
  const ivaPercent = budget.iva_percent !== undefined && budget.iva_percent !== null ? Number(budget.iva_percent) : 16;

  if (shouldIncludeChapters && currentChapter) {
    rows.push({
      type: 'chapter-subtotal',
      chapterId: currentChapter.id,
      description: `Total ${currencyHeader} ${currentChapter.description}:`,
      amount: currentChapterSubtotal
    });
  }

  const subtotalPresupuesto = items.filter(i => !i.is_chapter).reduce((sum, i) => sum + (calculatePU(i) * i.quantity), 0);
  const ivaAmount = subtotalPresupuesto * (ivaPercent / 100);
  const totalGeneral = subtotalPresupuesto + (config.includeIva ? ivaAmount : 0);

  const formatCurrency = (val) => val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const obra = (budget.project_name || budget.name || '').trim();
  const ubicacion = (config?.ubicacion || budget.ubicacion || budget.location || localStorage.getItem(`budget_ubicacion_${budget.id}`) || '').trim();
  const contratante = (budget.client_name || config?.contratante || '').trim();

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
      <div className="print-container" style={{ width: '100%', boxSizing: 'border-box' }}>
        {/* ENCABEZADO */}
        <div className="header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            {config.includeLogo && (
              <div className="logo" style={{ flexShrink: 0 }}>
                {(() => {
                  const savedLogo = localStorage.getItem(`budget_logo_${budget.id}`);
                  if (savedLogo) {
                    return <img src={savedLogo} alt="Logo Empresa" style={{ maxHeight: '65px' }} onError={(e) => e.target.style.display = 'none'} />;
                  }
                  return <img src="/images/logo_aeko360.png" alt="Logo Default" style={{ maxHeight: '65px' }} onError={(e) => e.target.style.display = 'none'} />;
                })()}
              </div>
            )}
            <div style={{ flex: 1 }}>
              {obra && (
                <p style={{ margin: '0 0 4px 0', fontSize: '15px', lineHeight: '1.3' }}>
                  <span style={{ fontWeight: 'bold', color: '#000' }}>Obra: </span>
                  <span style={{ fontWeight: 'normal', color: '#000' }}>{obra}</span>
                </p>
              )}
              {ubicacion && (
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  <span style={{ fontWeight: 'bold', color: '#000' }}>Ubicación: </span>
                  <span style={{ fontWeight: 'normal', color: '#000' }}>{ubicacion}</span>
                </p>
              )}
              {contratante && (
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  <span style={{ fontWeight: 'bold', color: '#000' }}>Contratante: </span>
                  <span style={{ fontWeight: 'normal', color: '#000' }}>{contratante}</span>
                </p>
              )}
              {config.includeRif && budget.company_rif && budget.company_rif.trim() && (
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  <span style={{ fontWeight: 'bold', color: '#000' }}>RIF: </span>
                  <span style={{ fontWeight: 'normal', color: '#000' }}>{budget.company_rif.trim()}</span>
                </p>
              )}
            </div>
          </div>
          <h2 style={{ textAlign: 'center', letterSpacing: '8px', marginTop: '16px', fontSize: '18px', fontWeight: 'bold' }}>
            {config.title || 'PRESUPUESTO'}
          </h2>
        </div>

        {/* TABLA DE PRESUPUESTO */}
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
              if (row.type === 'chapter') {
                return (
                  <tr key={`cap-${row.id}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td style={{ ...tdStyle, borderLeft: '1px solid #000', borderTop: '1px solid #000', borderBottom: '1px solid #000', width: '45px' }}></td>
                    <td colSpan="5" style={{ ...tdStyle, fontWeight: 'bold', paddingTop: '10px', borderRight: '1px solid #000', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                      {row.description}
                    </td>
                  </tr>
                );
              }

              if (row.type === 'chapter-subtotal') {
                return (
                  <tr key={`sub-${row.chapterId}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td colSpan="2" style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', paddingBottom: '10px', borderLeft: '1px solid #000', borderBottom: '1px solid #000' }}>
                      <span style={{ textDecoration: 'underline' }}>{row.description}</span>
                    </td>
                    <td colSpan="3" style={{ ...tdStyle, borderBottom: '1px solid #000' }}></td>
                    <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'right', textDecoration: 'underline', paddingBottom: '10px', borderRight: '1px solid #000', borderBottom: '1px solid #000', width: '125px' }}>
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                );
              }

              // Normal Item
              return (
                <tr key={`item-${row.id}`} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'top', width: '45px' }}>
                    {row.partNumber}
                  </td>
                  <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '10px' }}>{row.cov_par || row.cod_par}</div>
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

        {/* PIE DE TABLA / TOTALES Y NOTAS */}
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '11px', width: '100%', boxSizing: 'border-box' }}>
          {/* CUADRO DE NOTAS: Si está vacío NO coloca nada (ni la palabra nota ni el recuadro gris claro) */}
          {budget.notes && budget.notes.trim() !== '' ? (
            <div style={{ flex: 1, marginRight: '20px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '6px 10px', fontSize: '10px', backgroundColor: '#fff' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px', textTransform: 'uppercase', color: '#111827', fontSize: '10px' }}>
                Nota:
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#374151', lineHeight: '1.4' }}>
                {budget.notes}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }}></div>
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
