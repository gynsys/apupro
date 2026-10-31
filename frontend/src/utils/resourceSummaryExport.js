import { filterBlankComponentRows } from './apuRows';
import { toast } from 'react-hot-toast';

/**
 * Escapa caracteres HTML para inyección segura en plantillas
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formatea números en estándar venezolano / latinoamericano estricto:
 * - Separador de miles: punto (.)
 * - Separador de decimales: coma (,)
 * - Redondeo estricto a 2 decimales (o según el parámetro)
 */
export function formatNumber(val, decimals = 2) {
  const num = Number(val || 0);
  if (isNaN(num)) return '0,00';
  const fixed = num.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined ? `${withThousands},${decPart}` : withThousands;
}

/**
 * Obtiene el símbolo monetario según la moneda del presupuesto
 */
function getCurrencySymbol(budget) {
  const code = String(budget?.currency || 'USD').toUpperCase();
  if (['BS', 'BS.', 'BSF', 'VES', 'BOLIVAR', 'BOLÍVAR'].some((c) => code.startsWith(c))) {
    return 'Bs.';
  }
  return '$';
}

/**
 * Clasifica si un equipo corresponde a "Vehículos y Maquinarias Pesadas"
 * o a "Herramientas y Equipos Menores".
 */
export function isVehicleOrHeavyEquipment(eqOrDesc) {
  const desc = typeof eqOrDesc === 'string'
    ? eqOrDesc
    : (eqOrDesc?.description || eqOrDesc?.descripcion || eqOrDesc?.Descri || '');

  if (!desc) return false;

  // Si tiene un campo explícito en el objeto
  if (typeof eqOrDesc === 'object' && eqOrDesc !== null) {
    if (eqOrDesc.is_heavy === true || eqOrDesc.is_vehicle === true) return true;
    const cat = String(eqOrDesc.category || eqOrDesc.categoria || eqOrDesc.subgrupo || eqOrDesc.tipo || '').toLowerCase();
    if (/pesad|vehic|maquinaria|transporte|amarill/i.test(cat)) return true;
    if (/menor|herramienta|livian|manual/i.test(cat)) return false;
  }

  // Normalizar removiendo tildes para búsqueda ultra-confiable
  const d = desc
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Excepciones de equipos menores / herramientas manuales que podrían contener palabras similares
  if (/rana|bailarina|plancha|manual|portatil|trompo/i.test(d)) {
    if (!/camion|camioneta|pickup|tractor|retro/i.test(d)) {
      return false;
    }
  }

  // Palabras clave de Vehículos y Maquinarias Pesadas (sin tildes por la normalización)
  const heavyKeywords = [
    // Vehículos de transporte y carga
    /\bcamion\b/i,
    /\bcamiones\b/i,
    /\bcamioneta\b/i,
    /\bpick-?up\b/i,
    /\bgandola\b/i,
    /\bgandolas\b/i,
    /\bchuto\b/i,
    /\bchutos\b/i,
    /\bvolteo\b/i,
    /\bcisterna\b/i,
    /\bmixer\b/i,
    /\bhormigonera\b/i,
    /\bvolqueta\b/i,
    /\bvolquetas\b/i,
    /\bfurgon\b/i,
    /\blowboy\b/i,
    /\blow-?boy\b/i,
    /\bautobus\b/i,
    /\bvehiculo\b/i,
    /\bvehiculos\b/i,
    /\btrailer\b/i,
    /\bremolque\b/i,

    // Maquinaria pesada / movimiento de tierras / elevación
    /\bretroexcavador/i,
    /\bexcavador/i,
    /\bjumbo\b/i,
    /\btractor/i,
    /\bbulldozer\b/i,
    /\bpayloader\b/i,
    /\bpay-?loader\b/i,
    /\bcargador\s+(?:frontal|sobre\s+orugas|de\s+ruedas)/i,
    /\bminicargador/i,
    /\bbobcat\b/i,
    /\bmotonivelador/i,
    /\bpatrol\b/i,
    /\bmototrailla/i,
    /\bvibrocompactador/i,
    /\bcompactador\s+(?:autopropulsado|de\s+rodillo|pata\s+de\s+cabra|neumatico|tandem)/i,
    /\brodillo\s+(?:vibratorio|liso|pata\s+de\s+cabra|autopropulsado)/i,
    /\bpavimentador/i,
    /\bfinisher\b/i,
    /\bfresadora\b/i,
    /\bgrua\b/i,
    /\bgruas\b/i,
    /\bmontacargas\b/i,
    /\btelehandler\b/i,
    /\bpiloteadora/i,
    /\bperforadora\s+(?:hidraulica|de\s+pozo|sobre\s+orugas)/i,
    /\bdraga\b/i,
    /\bdumper\b/i,
    /\bzanjadora/i,
    /\btraila\b/i,
  ];

  return heavyKeywords.some((regex) => regex.test(d));
}

/**
 * Agrupa y consolida los recursos del presupuesto (Materiales, Equipos o Mano de Obra)
 * sin columna de referencia, replicando fielmente la estructura técnica de MaPreX.
 * Para equipos, clasifica en subcapítulos de Vehículos/Maquinarias Pesadas y Equipos Menores.
 */
export function getBudgetResourceSummary(budget, resourceType) {
  if (!budget || !Array.isArray(budget.items)) {
    return { items: [], totalGeneral: 0 };
  }

  const curr = budget.currency || 'USD';
  const exRate = ['BS', 'Bs', 'Bs.'].includes(curr)
    ? (parseFloat(budget.exchange_rate) || 1.0)
    : 1.0;

  const matInflation = parseFloat(budget.material_inflation || 0) || 0;
  const eqInflation = parseFloat(budget.equipment_inflation || 0) || 0;
  const labInflation = parseFloat(budget.labor_inflation || 0) || 0;
  const defaultLaborBonus = parseFloat(budget.labor_bonus || 0) || 0;
  const fcasPercent = parseFloat(budget.fcas_percent ?? budget.settings?.fcas_percent ?? 417.0);
  const rawBonoInFcas = budget.bono_in_fcas ?? budget.settings?.bono_in_fcas;
  const bonoInFcas = rawBonoInFcas === true || (rawBonoInFcas !== false && fcasPercent >= 1000);

  const round2 = (val) => Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;

  const map = new Map();

  budget.items
    .filter((item) => !item.is_chapter)
    .forEach((item) => {
      const itemQty = parseFloat(item.quantity) || 0;
      if (itemQty <= 0) return;
      const perf = parseFloat(item.performance ?? item.rendimiento ?? 1.0) || 1.0;

      if (resourceType === 'materials') {
        const materials = filterBlankComponentRows(item.materials || []);
        materials.forEach((mat) => {
          const desc = (mat.description ?? mat.descripcion ?? mat.Descri ?? '').trim().toUpperCase();
          if (!desc) return;
          const unit = (mat.unit ?? mat.unidad ?? mat.Unidad ?? 'UND').trim().toUpperCase();
          const q = parseFloat(mat.cantidad ?? mat.quantity ?? mat.CanIns ?? 0);
          const w = parseFloat(mat.desperdicio ?? mat.waste ?? mat.Desper ?? 0);
          const p = parseFloat(mat.precio_unitario ?? mat.price ?? mat.precio ?? mat.CosMat ?? 0) * exRate;
          const unitPrice = round2(p * (1 + (matInflation / 100)));

          const totalQty = round2(itemQty * q * (1 + w / 100));
          const totalCost = round2(totalQty * unitPrice);

          const key = `${desc}___${unit}`;
          if (map.has(key)) {
            const existing = map.get(key);
            existing.cantidad = round2(existing.cantidad + totalQty);
            existing.total = round2(existing.total + totalCost);
            existing.precio = existing.cantidad > 0 ? round2(existing.total / existing.cantidad) : unitPrice;
          } else {
            map.set(key, {
              description: desc,
              unit: unit,
              cantidad: totalQty,
              precio: unitPrice,
              total: totalCost,
            });
          }
        });
      } else if (resourceType === 'equipment') {
        const equipments = filterBlankComponentRows(item.equipments || []);
        equipments.forEach((eq) => {
          const desc = (eq.description ?? eq.descripcion ?? eq.Descri ?? '').trim().toUpperCase();
          if (!desc) return;
          const q = parseFloat(eq.cantidad ?? eq.quantity ?? eq.CanIns ?? 0);
          const d = parseFloat(eq.depreciacion ?? eq.depreciation ?? eq.Deprec ?? 1.0);
          const p = parseFloat(eq.precio_unitario ?? eq.price ?? eq.precio ?? eq.CosDia ?? 0) * exRate;
          const baseDailyPrice = round2(p * (1 + (eqInflation / 100)));

          const daysNeeded = round2((itemQty * q) / perf);
          const totalCost = round2(daysNeeded * d * baseDailyPrice);
          const isHeavy = isVehicleOrHeavyEquipment(eq);

          const key = `${desc}___${d.toFixed(6)}`;
          if (map.has(key)) {
            const existing = map.get(key);
            existing.cantidad = round2(existing.cantidad + daysNeeded);
            existing.total = round2(existing.total + totalCost);
          } else {
            map.set(key, {
              description: desc,
              precio: baseDailyPrice,
              depreciacion: d,
              cantidad: daysNeeded,
              total: totalCost,
              isHeavy,
            });
          }
        });
      } else if (resourceType === 'labor') {
        const labors = filterBlankComponentRows(item.labors || []);
        labors.forEach((lab) => {
          const desc = (lab.description ?? lab.descripcion ?? lab.Descri ?? '').trim().toUpperCase();
          if (!desc) return;
          const q = parseFloat(lab.cantidad ?? lab.quantity ?? lab.CanIns ?? 0);
          const j = parseFloat(lab.jornal ?? lab.Jornal ?? 0) * exRate;
          const bBonus = (lab.bono !== undefined && lab.bono !== null && !isNaN(Number(lab.bono)))
            ? Number(lab.bono)
            : defaultLaborBonus;
          const b = bBonus * exRate;

          const baseJornal = round2(j * (1 + (labInflation / 100)));
          const baseBono = round2(b * (1 + (labInflation / 100)));

          const fcasMonto = round2(baseJornal * (fcasPercent / 100));
          const dailyCostPerWorker = round2(baseJornal + (bonoInFcas ? 0 : baseBono) + fcasMonto);

          const daysNeeded = round2((itemQty * q) / perf);
          const totalCost = round2(daysNeeded * dailyCostPerWorker);

          const key = `${desc}___${baseJornal.toFixed(2)}___${baseBono.toFixed(2)}`;
          if (map.has(key)) {
            const existing = map.get(key);
            existing.cantidad = round2(existing.cantidad + daysNeeded);
            existing.total = round2(existing.total + totalCost);
          } else {
            map.set(key, {
              description: desc,
              jornal: baseJornal,
              bono: baseBono,
              cantidad: daysNeeded,
              total: totalCost,
            });
          }
        });
      }
    });

  const list = Array.from(map.values()).sort((a, b) => a.description.localeCompare(b.description));
  const totalGeneral = round2(list.reduce((acc, row) => acc + row.total, 0));

  if (resourceType === 'equipment') {
    const minorList = list.filter((it) => !it.isHeavy);
    const heavyList = list.filter((it) => it.isHeavy);
    const totalMinor = round2(minorList.reduce((acc, row) => acc + row.total, 0));
    const totalHeavy = round2(heavyList.reduce((acc, row) => acc + row.total, 0));

    return {
      items: list,
      totalGeneral,
      subchapters: {
        minor: {
          title: 'HERRAMIENTAS Y EQUIPOS MENORES',
          items: minorList,
          total: totalMinor,
        },
        heavy: {
          title: 'VEHÍCULOS Y MAQUINARIAS PESADAS',
          items: heavyList,
          total: totalHeavy,
        },
      },
      hasHeavyEquipment: heavyList.length > 0,
      hasMinorEquipment: minorList.length > 0,
    };
  }

  return { items: list, totalGeneral };
}

/**
 * Imprime el reporte oficial de resumen de recursos en formato PDF / Papel
 */
export function printResourceSummary(budget, resourceType) {
  const summaryData = getBudgetResourceSummary(budget, resourceType);
  const { items, totalGeneral } = summaryData;

  if (!items || items.length === 0) {
    toast.error('No hay insumos registrados para este resumen.');
    return;
  }

  const currencySym = getCurrencySymbol(budget);
  const obra = (budget?.project_name || budget?.name || 'Obra').trim();
  const contratante = (budget?.client_name || '').trim();
  const today = new Date().toLocaleDateString('es-VE');

  let title = '';
  let theadHtml = '';
  let rowsHtml = '';
  let footnote = '';

  if (resourceType === 'materials') {
    title = 'RESUMEN DE MATERIALES DEL PRESUPUESTO';
    theadHtml = `
      <tr>
        <th style="text-align: left; width: 55%;">Descripción</th>
        <th style="text-align: center; width: 10%;">Unidad</th>
        <th style="text-align: right; width: 12%;">Cantidad</th>
        <th style="text-align: right; width: 11%;">Precio Unitario ${escapeHtml(currencySym)}</th>
        <th style="text-align: right; width: 12%;">Total ${escapeHtml(currencySym)}</th>
      </tr>
    `;
    rowsHtml = items
      .map(
        (it) => `
        <tr>
          <td style="text-align: left;">${escapeHtml(it.description)}</td>
          <td style="text-align: center;">${escapeHtml(it.unit)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNumber(it.cantidad, 2)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNumber(it.precio, 2)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: 600;">${formatNumber(it.total, 2)}</td>
        </tr>
      `
      )
      .join('');
  } else if (resourceType === 'equipment') {
    title = 'RESUMEN DE EQUIPOS DEL PRESUPUESTO';
    theadHtml = `
      <tr>
        <th style="text-align: left; width: 52%;">Descripción</th>
        <th style="text-align: right; width: 12%;">Precio ${escapeHtml(currencySym)}</th>
        <th style="text-align: right; width: 10%;">COP/Dep.</th>
        <th style="text-align: right; width: 12%;">Cantidad</th>
        <th style="text-align: right; width: 14%;">Total ${escapeHtml(currencySym)}</th>
      </tr>
    `;

    const renderEqRow = (it) => `
      <tr>
        <td style="text-align: left; padding-left: 12px;">${escapeHtml(it.description)}</td>
        <td style="text-align: right; font-family: monospace;">${formatNumber(it.precio, 2)}</td>
        <td style="text-align: right; font-family: monospace;">${formatNumber(it.depreciacion, it.depreciacion < 0.01 && it.depreciacion > 0 ? 6 : 2)}</td>
        <td style="text-align: right; font-family: monospace;">${formatNumber(it.cantidad, 2)}</td>
        <td style="text-align: right; font-family: monospace; font-weight: 600;">${formatNumber(it.total, 2)}</td>
      </tr>
    `;

    const { subchapters, hasHeavyEquipment, hasMinorEquipment } = summaryData;

    if (hasHeavyEquipment && hasMinorEquipment) {
      rowsHtml = `
        <tr class="subchapter-header">
          <td colspan="5">1. HERRAMIENTAS Y EQUIPOS MENORES</td>
        </tr>
        ${subchapters.minor.items.map(renderEqRow).join('')}
        <tr class="subtotal-row">
          <td colspan="4" style="text-align: right;">Subtotal Herramientas y Equipos Menores ${escapeHtml(currencySym)}:</td>
          <td style="text-align: right; font-family: monospace;">${formatNumber(subchapters.minor.total, 2)}</td>
        </tr>
        <tr class="subchapter-header">
          <td colspan="5">2. VEHÍCULOS Y MAQUINARIAS PESADAS</td>
        </tr>
        ${subchapters.heavy.items.map(renderEqRow).join('')}
        <tr class="subtotal-row">
          <td colspan="4" style="text-align: right;">Subtotal Vehículos y Maquinarias Pesadas ${escapeHtml(currencySym)}:</td>
          <td style="text-align: right; font-family: monospace;">${formatNumber(subchapters.heavy.total, 2)}</td>
        </tr>
      `;
    } else if (hasHeavyEquipment) {
      rowsHtml = `
        <tr class="subchapter-header">
          <td colspan="5">VEHÍCULOS Y MAQUINARIAS PESADAS</td>
        </tr>
        ${subchapters.heavy.items.map(renderEqRow).join('')}
        <tr class="subtotal-row">
          <td colspan="4" style="text-align: right;">Subtotal Vehículos y Maquinarias Pesadas ${escapeHtml(currencySym)}:</td>
          <td style="text-align: right; font-family: monospace;">${formatNumber(subchapters.heavy.total, 2)}</td>
        </tr>
      `;
    } else {
      rowsHtml = `
        <tr class="subchapter-header">
          <td colspan="5">HERRAMIENTAS Y EQUIPOS MENORES</td>
        </tr>
        ${subchapters?.minor?.items?.map(renderEqRow).join('') || items.map(renderEqRow).join('')}
        <tr class="subtotal-row">
          <td colspan="4" style="text-align: right;">Subtotal Herramientas y Equipos Menores ${escapeHtml(currencySym)}:</td>
          <td style="text-align: right; font-family: monospace;">${formatNumber(totalGeneral, 2)}</td>
        </tr>
      `;
    }

    footnote =
      'Nota: La cantidad necesaria de equipos con presencia física en la obra depende del cronograma de trabajo, el cual definirá la simultaneidad de las actividades.';
  } else if (resourceType === 'labor') {
    title = 'RESUMEN DE MANO DE OBRA DEL PRESUPUESTO';
    theadHtml = `
      <tr>
        <th style="text-align: left; width: 55%;">Descripción</th>
        <th style="text-align: right; width: 11%;">Jornal</th>
        <th style="text-align: right; width: 11%;">Bono</th>
        <th style="text-align: right; width: 11%;">Cantidad</th>
        <th style="text-align: right; width: 12%;">Total ${escapeHtml(currencySym)}</th>
      </tr>
    `;
    rowsHtml = items
      .map(
        (it) => `
        <tr>
          <td style="text-align: left;">${escapeHtml(it.description)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNumber(it.jornal, 2)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNumber(it.bono, 2)}</td>
          <td style="text-align: right; font-family: monospace;">${formatNumber(it.cantidad, 2)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: 600;">${formatNumber(it.total, 2)}</td>
        </tr>
      `
      )
      .join('');
    footnote =
      'Nota: La cantidad necesaria de trabajadores con presencia física en la obra depende del cronograma de trabajo, el cual definirá la simultaneidad de las actividades.';
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Por favor permite ventanas emergentes en tu navegador para imprimir.');
    return;
  }

  const printHtml = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)} - ${escapeHtml(obra)}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            color: #0f172a;
            margin: 0;
            padding: 10px;
            background-color: #fff;
          }
          .meta-header {
            margin-bottom: 14px;
            font-size: 11px;
            line-height: 1.5;
          }
          .meta-header strong {
            color: #0f172a;
          }
          .doc-title {
            font-size: 14px;
            font-weight: 900;
            text-align: center;
            margin: 16px 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th {
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            padding: 5px 6px;
            font-size: 9px;
            font-weight: bold;
            background-color: #f8fafc;
            color: #0f172a;
          }
          td {
            border-bottom: 1px solid #e2e8f0;
            padding: 3.5px 6px;
            font-size: 9.5px;
            vertical-align: middle;
          }
          tr:nth-child(even) td {
            background-color: #fcfcfd;
          }
          .subchapter-header td {
            background-color: #f1f5f9;
            font-weight: 800;
            font-size: 10px;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-top: 1.5px solid #0f172a;
            border-bottom: 1px solid #cbd5e1;
            padding: 6px 8px;
          }
          .subtotal-row td {
            background-color: #f8fafc;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1.5px solid #64748b;
            font-weight: bold;
            font-size: 10px;
            padding: 5px 8px;
          }
          .total-row td {
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            font-weight: 900;
            font-size: 11px;
            padding: 6px;
            background-color: #fff;
          }
          .footnote {
            margin-top: 14px;
            font-size: 9px;
            color: #334155;
            font-style: italic;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="meta-header">
          <div><strong>Obra:</strong> ${escapeHtml(obra)}</div>
          <div><strong>Contratante:</strong> ${escapeHtml(contratante || '—')}</div>
          <div><strong>Fecha:</strong> ${escapeHtml(today)}</div>
        </div>

        <div class="doc-title">${escapeHtml(title)}</div>

        <table>
          <thead>
            ${theadHtml}
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="${resourceType === 'equipment' ? 4 : 4}" style="text-align: right;">Total General ${resourceType === 'equipment' ? 'Equipos ' : ''}${escapeHtml(currencySym)}:</td>
              <td style="text-align: right; font-family: monospace;">${formatNumber(totalGeneral, 2)}</td>
            </tr>
          </tbody>
        </table>

        ${footnote ? `<div class="footnote">${escapeHtml(footnote)}</div>` : ''}

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
}

/**
 * Exporta el reporte oficial de resumen de recursos a Microsoft Excel (.xls / .xlsx)
 */
export function exportResourceSummaryToExcel(budget, resourceType) {
  const summaryData = getBudgetResourceSummary(budget, resourceType);
  const { items, totalGeneral } = summaryData;

  if (!items || items.length === 0) {
    toast.error('No hay insumos registrados para este resumen.');
    return;
  }

  const currencySym = getCurrencySymbol(budget);
  const obra = (budget?.project_name || budget?.name || 'Obra').trim();
  const contratante = (budget?.client_name || '').trim();
  const today = new Date().toLocaleDateString('es-VE');

  let title = '';
  let theadHtml = '';
  let rowsHtml = '';
  let footnote = '';
  let colSpan = 4;

  if (resourceType === 'materials') {
    title = 'RESUMEN DE MATERIALES DEL PRESUPUESTO';
    colSpan = 4;
    theadHtml = `
      <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold;">
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Descripción</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">Unidad</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Cantidad</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Precio Unitario ${escapeHtml(currencySym)}</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Total ${escapeHtml(currencySym)}</th>
      </tr>
    `;
    rowsHtml = items
      .map(
        (it) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: left;">${escapeHtml(it.description)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: center;">${escapeHtml(it.unit)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.cantidad, 2)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.precio, 2)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.total, 2)}</td>
        </tr>
      `
      )
      .join('');
  } else if (resourceType === 'equipment') {
    title = 'RESUMEN DE EQUIPOS DEL PRESUPUESTO';
    colSpan = 4;
    theadHtml = `
      <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold;">
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Descripción</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Precio ${escapeHtml(currencySym)}</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">COP/Dep.</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Cantidad</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Total ${escapeHtml(currencySym)}</th>
      </tr>
    `;

    const renderExcelEqRow = (it) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: left; padding-left: 12px;">${escapeHtml(it.description)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.precio, 2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.depreciacion, it.depreciacion < 0.01 && it.depreciacion > 0 ? 6 : 2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.cantidad, 2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.total, 2)}</td>
      </tr>
    `;

    const { subchapters, hasHeavyEquipment, hasMinorEquipment } = summaryData;

    if (hasHeavyEquipment && hasMinorEquipment) {
      rowsHtml = `
        <tr style="background-color: #e2e8f0; font-weight: bold;">
          <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11pt; color: #0f172a;">
            1. HERRAMIENTAS Y EQUIPOS MENORES
          </td>
        </tr>
        ${subchapters.minor.items.map(renderExcelEqRow).join('')}
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td colspan="4" style="border: 1px solid #cbd5e1; text-align: right; padding: 5px;">Subtotal Herramientas y Equipos Menores ${escapeHtml(currencySym)}:</td>
          <td style="border: 1px solid #cbd5e1; text-align: right; padding: 5px; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(subchapters.minor.total, 2)}</td>
        </tr>
        <tr style="background-color: #e2e8f0; font-weight: bold;">
          <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11pt; color: #0f172a;">
            2. VEHÍCULOS Y MAQUINARIAS PESADAS
          </td>
        </tr>
        ${subchapters.heavy.items.map(renderExcelEqRow).join('')}
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td colspan="4" style="border: 1px solid #cbd5e1; text-align: right; padding: 5px;">Subtotal Vehículos y Maquinarias Pesadas ${escapeHtml(currencySym)}:</td>
          <td style="border: 1px solid #cbd5e1; text-align: right; padding: 5px; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(subchapters.heavy.total, 2)}</td>
        </tr>
      `;
    } else if (hasHeavyEquipment) {
      rowsHtml = `
        <tr style="background-color: #e2e8f0; font-weight: bold;">
          <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11pt; color: #0f172a;">
            VEHÍCULOS Y MAQUINARIAS PESADAS
          </td>
        </tr>
        ${subchapters.heavy.items.map(renderExcelEqRow).join('')}
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td colspan="4" style="border: 1px solid #cbd5e1; text-align: right; padding: 5px;">Subtotal Vehículos y Maquinarias Pesadas ${escapeHtml(currencySym)}:</td>
          <td style="border: 1px solid #cbd5e1; text-align: right; padding: 5px; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(subchapters.heavy.total, 2)}</td>
        </tr>
      `;
    } else {
      rowsHtml = `
        <tr style="background-color: #e2e8f0; font-weight: bold;">
          <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11pt; color: #0f172a;">
            HERRAMIENTAS Y EQUIPOS MENORES
          </td>
        </tr>
        ${subchapters?.minor?.items?.map(renderExcelEqRow).join('') || items.map(renderExcelEqRow).join('')}
        <tr style="background-color: #f8fafc; font-weight: bold;">
          <td colspan="4" style="border: 1px solid #cbd5e1; text-align: right; padding: 5px;">Subtotal Herramientas y Equipos Menores ${escapeHtml(currencySym)}:</td>
          <td style="border: 1px solid #cbd5e1; text-align: right; padding: 5px; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(totalGeneral, 2)}</td>
        </tr>
      `;
    }

    footnote =
      'Nota: La cantidad necesaria de equipos con presencia física en la obra depende del cronograma de trabajo, el cual definirá la simultaneidad de las actividades.';
  } else if (resourceType === 'labor') {
    title = 'RESUMEN DE MANO DE OBRA DEL PRESUPUESTO';
    colSpan = 4;
    theadHtml = `
      <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold;">
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Descripción</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Jornal</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Bono</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Cantidad</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Total ${escapeHtml(currencySym)}</th>
      </tr>
    `;
    rowsHtml = items
      .map(
        (it) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: left;">${escapeHtml(it.description)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.jornal, 2)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.bono, 2)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.cantidad, 2)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; font-weight: bold; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(it.total, 2)}</td>
        </tr>
      `
      )
      .join('');
    footnote =
      'Nota: La cantidad necesaria de trabajadores con presencia física en la obra depende del cronograma de trabajo, el cual definirá la simultaneidad de las actividades.';
  }

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(resourceType.toUpperCase())}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
          .title { font-size: 14pt; font-weight: bold; text-align: center; }
          .meta { font-size: 10pt; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="${colSpan + 1}" class="title">${escapeHtml(title)}</td></tr>
          <tr><td colspan="${colSpan + 1}"></td></tr>
          <tr><td colspan="${colSpan + 1}" class="meta">Obra: ${escapeHtml(obra)}</td></tr>
          <tr><td colspan="${colSpan + 1}" class="meta">Contratante: ${escapeHtml(contratante || '—')}</td></tr>
          <tr><td colspan="${colSpan + 1}" class="meta">Fecha: ${escapeHtml(today)}</td></tr>
          <tr><td colspan="${colSpan + 1}"></td></tr>
          <thead>
            ${theadHtml}
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td colspan="${colSpan}" style="border: 1px solid #cbd5e1; text-align: right; padding: 6px;">Total General ${resourceType === 'equipment' ? 'Equipos ' : ''}${escapeHtml(currencySym)}:</td>
              <td style="border: 1px solid #cbd5e1; text-align: right; padding: 6px; mso-number-format:'\\#\\,\\#\\#0\\.00';">${formatNumber(totalGeneral, 2)}</td>
            </tr>
          </tbody>
        </table>
        ${footnote ? `<p style="font-size: 9pt; font-style: italic; color: #475569;">${escapeHtml(footnote)}</p>` : ''}
      </body>
    </html>
  `;

  const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success('Resumen exportado a Excel exitosamente');
}
