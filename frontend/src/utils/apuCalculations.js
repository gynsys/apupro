/**
 * APU and Budget Calculation Utilities
 * Single Source of Truth for APU and Budget Calculations across:
 * - BudgetWorksheetPage (Desktop & Mobile)
 * - BudgetAPUEditorPage & ApuEditorUI
 * - BudgetPrintLayout & PrintAPULayout
 * - ExportApuExcelButton
 */
import { filterBlankComponentRows } from './apuRows.js';

/**
 * Calculates the complete breakdown and unit price for an APU item.
 * 
 * @param {Object} item - The budget item or APU item
 * @param {Object} budget - The budget settings/configuration
 * @returns {Object} Complete breakdown of materials, equipment, labor, overheads and unit price.
 */
export function calculateItemBreakdown(item, budget = {}) {
  const zeroBreakdown = {
    matCost: 0,
    eqTotalDay: 0,
    eqCost: 0,
    totJornal: 0,
    totBono: 0,
    fcasPercent: 417.0,
    fcasMonto: 0,
    labTotalDay: 0,
    labCost: 0,
    subtotalA: 0,
    adminPercent: 15.0,
    adminCost: 0,
    subtotalB: 0,
    profitPercent: 10.0,
    profitCost: 0,
    subtotalC: 0,
    ivaPercent: 0,
    ivaCost: 0,
    unitPrice: 0,
    unitPriceWithIva: 0,
    materiales: 0,
    equipos: 0,
    manoObra: 0
  };

  if (!item || item.is_chapter) return zeroBreakdown;

  const curr = budget?.currency || item?.currency || 'USD';
  const exRate = (curr === 'BS' || curr === 'Bs' || curr === 'Bs.')
    ? (parseFloat(budget?.exchange_rate ?? item?.exchange_rate) || 1.0)
    : 1.0;

  const matInflation = parseFloat(budget?.material_inflation ?? item?.material_inflation ?? 0) || 0;
  const eqInflation = parseFloat(budget?.equipment_inflation ?? item?.equipment_inflation ?? 0) || 0;
  const labInflation = parseFloat(budget?.labor_inflation ?? item?.labor_inflation ?? 0) || 0;
  const defaultLaborBonus = parseFloat(budget?.labor_bonus ?? item?.labor_bonus ?? 0) || 0;
  const perf = parseFloat(item.performance ?? item.rendimiento ?? item.RenPar ?? 1.0) || 1.0;

  const round2 = (val) => Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;

  // Filtrar filas en blanco / plantillas de entrada para no sumar valores residuales ni bonos ficticios
  const materials = filterBlankComponentRows(item?.materials || []);
  const equipments = filterBlankComponentRows(item?.equipments || []);
  const labors = filterBlankComponentRows(item?.labors || []);

  // 1. Materiales
  const matCost = round2(materials.reduce((acc, currMat) => {
    const q = parseFloat(currMat.cantidad ?? currMat.quantity ?? currMat.CanIns ?? 0);
    const w = parseFloat(currMat.desperdicio ?? currMat.waste ?? currMat.Desper ?? 0);
    const p = parseFloat(currMat.precio_unitario ?? currMat.price ?? currMat.precio ?? currMat.CosMat ?? 0) * exRate;
    const baseCost = round2((q * (1 + w / 100)) * p);
    return acc + (baseCost * (1 + (matInflation / 100)));
  }, 0));

  // 2. Equipos
  const eqTotalDay = round2(equipments.reduce((acc, currEq) => {
    const q = parseFloat(currEq.cantidad ?? currEq.quantity ?? currEq.CanIns ?? 0);
    const d = parseFloat(currEq.depreciacion ?? currEq.depreciation ?? currEq.Deprec ?? 1.0);
    const p = parseFloat(currEq.precio_unitario ?? currEq.price ?? currEq.precio ?? currEq.CosDia ?? 0) * exRate;
    const baseCost = round2(q * d * p);
    return acc + (baseCost * (1 + (eqInflation / 100)));
  }, 0));
  const eqCost = round2(eqTotalDay / perf);

  // 3. Mano de Obra
  const totJornal = round2(labors.reduce((acc, currLab) => {
    const q = parseFloat(currLab.cantidad ?? currLab.quantity ?? currLab.CanIns ?? 0);
    const j = parseFloat(currLab.jornal ?? currLab.Jornal ?? 0) * exRate;
    const baseCost = round2(q * j);
    return acc + (baseCost * (1 + (labInflation / 100)));
  }, 0));

  const fcasPercent = parseFloat(budget?.fcas_percent ?? item?.fcas_percent ?? budget?.settings?.fcas_percent ?? 417.0);
  const rawBonoInFcas = budget?.bono_in_fcas ?? item?.bono_in_fcas ?? budget?.settings?.bono_in_fcas;
  const bonoInFcas = rawBonoInFcas === true || (rawBonoInFcas !== false && fcasPercent >= 1000);

  let totBono = 0;
  if (!bonoInFcas) {
    totBono = round2(labors.reduce((acc, currLab) => {
      const q = parseFloat(currLab.cantidad ?? currLab.quantity ?? currLab.CanIns ?? 0);
      const bBonus = (currLab.bono !== undefined && currLab.bono !== null && !isNaN(Number(currLab.bono)))
        ? Number(currLab.bono)
        : ((currLab.Bono !== undefined && currLab.Bono !== null && !isNaN(Number(currLab.Bono)))
          ? Number(currLab.Bono)
          : defaultLaborBonus);
      const b = bBonus * exRate;
      const baseCost = round2(q * b);
      return acc + (baseCost * (1 + (labInflation / 100)));
    }, 0));
  }

  const fcasMonto = round2(totJornal * (fcasPercent / 100));
  const labTotalDay = round2(totJornal + totBono + fcasMonto);
  const labCost = round2(labTotalDay / perf);

  // Overheads: Subtotal A -> Subtotal B -> Subtotal C (Precio Unitario)
  const subtotalA = round2(matCost + eqCost + labCost);
  const adminPercent = parseFloat(budget?.admin_percent ?? item?.admin_percent ?? budget?.settings?.admin_percent ?? 15.0);
  const profitPercent = parseFloat(budget?.profit_percent ?? budget?.util_percent ?? item?.profit_percent ?? item?.util_percent ?? budget?.settings?.profit_percent ?? 10.0);
  const ivaPercent = parseFloat(budget?.iva_percent ?? item?.iva_percent ?? budget?.settings?.iva_percent ?? 0.0);

  const adminCost = round2(subtotalA * (adminPercent / 100));
  const subtotalB = round2(subtotalA + adminCost);
  const profitCost = round2(subtotalB * (profitPercent / 100));
  const subtotalC = round2(subtotalB + profitCost);

  // Redondear el Precio Unitario siempre a 2 decimales exactos
  const unitPrice = subtotalC;
  const ivaCost = round2(unitPrice * (ivaPercent / 100));
  const unitPriceWithIva = round2(unitPrice + ivaCost);

  return {
    matCost,
    eqTotalDay,
    eqCost,
    totJornal,
    totBono,
    fcasPercent,
    fcasMonto,
    labTotalDay,
    labCost,
    subtotalA,
    adminPercent,
    adminCost,
    subtotalB,
    profitPercent,
    profitCost,
    subtotalC,
    ivaPercent,
    ivaCost,
    unitPrice,
    unitPriceWithIva,
    materiales: matCost,
    equipos: eqCost,
    manoObra: labCost
  };
}

/**
 * Calculates the unit price (Subtotal C: Costo Directo + Admin + Utilidad) for an APU item.
 * Note: The unit price of an APU never includes IVA. IVA is applied to the global budget total.
 * 
 * @param {Object} item - The budget item or APU item
 * @param {Object} budget - The budget settings/configuration
 * @returns {number} The calculated unit price (Subtotal C)
 */
export function calculateItemPU(item, budget = {}) {
  const breakdown = calculateItemBreakdown(item, budget);
  return breakdown.unitPrice;
}

/**
 * Calculates the totals for a complete budget.
 * 
 * @param {Object} budget - The budget object containing items and settings
 * @returns {Object} { subtotalPresupuesto, ivaAmount, totalGeneral }
 */
export function calculateBudgetTotals(budget = {}) {
  if (!budget || !budget.items) {
    return { subtotalPresupuesto: 0, ivaAmount: 0, totalGeneral: 0 };
  }

  const subtotalPresupuesto = (budget.items || [])
    .filter(i => !i.is_chapter)
    .reduce((sum, item) => {
      const pu = calculateItemPU(item, budget);
      const qty = parseFloat(item.quantity) || 0;
      const itemTotal = Math.round((pu * qty + Number.EPSILON) * 100) / 100;
      return sum + itemTotal;
    }, 0);

  const roundedSubtotal = Math.round((subtotalPresupuesto + Number.EPSILON) * 100) / 100;
  const ivaPercent = parseFloat(budget.iva_percent ?? 16.0);
  const ivaAmount = Math.round((roundedSubtotal * (ivaPercent / 100) + Number.EPSILON) * 100) / 100;
  const totalGeneral = Math.round((roundedSubtotal + ivaAmount + Number.EPSILON) * 100) / 100;

  return { subtotalPresupuesto: roundedSubtotal, ivaAmount, totalGeneral };
}
