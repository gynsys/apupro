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
            description: `Total ${config.currency}. ${currentChapter.description}:`,
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

  if (shouldIncludeChapters && currentChapter) {
    rows.push({
      type: 'chapter-subtotal',
      chapterId: currentChapter.id,
      description: `Total ${config.currency}. ${currentChapter.description}:`,
      amount: currentChapterSubtotal
    });
  }

  const subtotalPresupuesto = items.filter(i => !i.is_chapter).reduce((sum, i) => sum + (calculatePU(i) * i.quantity), 0);
  const ivaAmount = subtotalPresupuesto * ((budget.iva_percent ?? 16.0) / 100);
  const totalGeneral = subtotalPresupuesto + (config.includeIva ? ivaAmount : 0);

  const formatCurrency = (val) => val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return createPortal(
    <div className="print-only" style={{ display: 'none', backgroundColor: '#fff', color: '#000', fontFamily: 'Arial, sans-serif' }}>
      <div className="print-container">
        {/* ENCABEZADO */}
        <div className="header" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            {config.includeLogo && (
              <div className="logo" style={{ flexShrink: 0 }}>
                {(() => {
                  const savedLogo = localStorage.getItem(`budget_logo_${budget.id}`);
                  if (savedLogo) {
                    return <img src={savedLogo} alt="Logo Empresa" style={{ maxHeight: '60px' }} onError={(e) => e.target.style.display = 'none'} />;
                  }
                  return <img src="/images/logo_aeko360.png" alt="Logo Default" style={{ maxHeight: '60px' }} onError={(e) => e.target.style.display = 'none'} />;
                })()}
              </div>
            )}
            <div style={{ fontSize: '12px', fontWeight: 'bold', flex: 1 }}>
              <p style={{ margin: '2px 0' }}>Obra: <span style={{fontWeight: 'normal'}}>{budget.project_name || 'N/A'}</span></p>
              {budget.client_name && (
                <p style={{ margin: '2px 0' }}>Contratante: <span style={{fontWeight: 'normal'}}>{budget.client_name}</span></p>
              )}
              {config.includeRif && budget.company_rif && (
                <p style={{ margin: '2px 0' }}>RIF: <span style={{fontWeight: 'normal'}}>{budget.company_rif}</span></p>
              )}
            </div>
          </div>
          <h2 style={{ textAlign: 'center', letterSpacing: '8px', marginTop: '20px', fontSize: '18px' }}>
            {config.title || 'PRESUPUESTO'}
          </h2>
        </div>

        {/* TABLA DE PRESUPUESTO */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', borderBottom: '1px solid #000' }}>
          <thead>
            <tr>
              <th style={thStyle}>Part. No</th>
              <th style={{ ...thStyle, width: '45%' }}>Descripción</th>
              <th style={thStyle}>Und.</th>
              <th style={thStyle}>Cantidad</th>
              <th style={thStyle}>Precio Unitario</th>
              <th style={thStyle}>Total {config.currency}.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.type === 'chapter') {
                return (
                  <tr key={`cap-${row.id}`}>
                    <td style={{ ...tdStyle, borderLeft: '1px solid #000', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}></td>
                    <td colSpan="5" style={{ ...tdStyle, fontWeight: 'bold', paddingTop: '10px', borderRight: '1px solid #000', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                      {row.description}
                    </td>
                  </tr>
                );
              }

              if (row.type === 'chapter-subtotal') {
                return (
                  <tr key={`sub-${row.chapterId}`}>
                    <td colSpan="2" style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', paddingBottom: '10px', borderLeft: '1px solid #000', borderBottom: '1px solid #000' }}>
                      <span style={{ textDecoration: 'underline' }}>{row.description}</span>
                    </td>
                    <td colSpan="3" style={{ ...tdStyle, borderBottom: '1px solid #000' }}></td>
                    <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'right', textDecoration: 'underline', paddingBottom: '10px', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                );
              }

              // Normal Item
              return (
                <tr key={`item-${row.id}`}>
                  <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'top' }}>
                    {row.partNumber}
                  </td>
                  <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '10px' }}>{row.cov_par || row.cod_par}</div>
                    <div>{row.description}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'top' }}>
                    {row.unit}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', verticalAlign: 'top' }}>
                    {formatCurrency(row.quantity)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', verticalAlign: 'top' }}>
                    {formatCurrency(row.pu)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', verticalAlign: 'top' }}>
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* PIE DE TABLA / TOTALES Y NOTAS */}
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '11px', gap: '20px' }}>
          {/* CUADRO DE NOTAS: Si está vacío NO coloca nada (ni la palabra nota ni el recuadro gris claro) */}
          {budget.notes && budget.notes.trim() !== '' ? (
            <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '4px', padding: '6px 10px', fontSize: '10px', backgroundColor: '#fff' }}>
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

          <table style={{ width: '40%', borderCollapse: 'collapse', flexShrink: 0 }}>
            <tbody>
              <tr>
                <td style={{ ...totalLabelStyle }}>Total Hoja (Sin I.V.A.):</td>
                <td style={{ ...totalValueStyle }}>{formatCurrency(subtotalPresupuesto)}</td>
              </tr>
              <tr>
                <td style={{ ...totalLabelStyle }}>Total Acumulado (Sin I.V.A.):</td>
                <td style={{ ...totalValueStyle }}>{formatCurrency(subtotalPresupuesto)}</td>
              </tr>
              {config.includeIva && (
                <tr>
                  <td style={{ ...totalLabelStyle }}>Total I.V.A. ({budget.iva_percent ?? 16}%):</td>
                  <td style={{ ...totalValueStyle }}>{formatCurrency(ivaAmount)}</td>
                </tr>
              )}
              <tr>
                <td style={{ ...totalLabelStyle, fontWeight: 'bold' }}>Total {config.currency}.:</td>
                <td style={{ ...totalValueStyle, fontWeight: 'bold' }}>{formatCurrency(totalGeneral)}</td>
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
  backgroundColor: '#fff'
};

const tdStyle = {
  borderLeft: '1px solid #000',
  borderRight: '1px solid #000',
  borderBottom: 'none',
  borderTop: 'none',
  padding: '4px 6px'
};

const totalLabelStyle = {
  textAlign: 'right',
  padding: '4px 8px',
  border: 'none',
  paddingRight: '12px'
};

const totalValueStyle = {
  border: '1px solid #000',
  padding: '4px 8px',
  textAlign: 'right',
  width: '120px'
};
