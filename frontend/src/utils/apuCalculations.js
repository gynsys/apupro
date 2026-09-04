/**
 * APU and Budget Calculation Utilities
 * Ensures consistent calculations between BudgetWorksheetPage, BudgetHomePage,
 * BudgetPrintLayout, and ApuEditorUI.
 */

/**
 * Calculates the unit price (Subtotal C: Costo Directo + Admin + Utilidad) for an APU item.
 * Note: The unit price of an APU never includes IVA. IVA is applied to the global budget total.
 * 
 * @param {Object} item - The budget item or APU item
 * @param {Object} budget - The budget settings/configuration
 * @returns {number} The calculated unit price (Subtotal C)
 */
export function calculateItemPU(item, budget = {}) {
  if (!item || item.is_chapter) return 0;

  const exRate = budget?.currency === 'BS' ? (parseFloat(budget?.exchange_rate) || 1.0) : 1.0;
  const matInflation = parseFloat(budget?.material_inflation) || 0;
  const eqInflation = parseFloat(budget?.equipment_inflation) || 0;
  const labInflation = parseFloat(budget?.labor_inflation) || 0;
  const defaultLaborBonus = parseFloat(budget?.labor_bonus) || 0;
  const perf = parseFloat(item.performance ?? item.rendimiento ?? 1.0) || 1.0;

  // 1. Materiales
  const matCost = (item.materials || []).reduce((acc, curr) => {
    const q = parseFloat(curr.cantidad ?? curr.quantity ?? 0);
    const w = parseFloat(curr.desperdicio ?? curr.waste ?? 0);
    const p = parseFloat(curr.precio_unitario ?? curr.price ?? 0) * exRate;
    const baseCost = (q * (1 + w / 100)) * p;
    return acc + (baseCost * (1 + (matInflation / 100)));
  }, 0);

  // 2. Equipos
  const eqTotalDay = (item.equipments || []).reduce((acc, curr) => {
    const q = parseFloat(curr.cantidad ?? curr.quantity ?? 0);
    const d = parseFloat(curr.depreciacion ?? curr.depreciation ?? 1.0);
    const p = parseFloat(curr.precio_unitario ?? curr.price ?? 0) * exRate;
    const baseCost = q * d * p;
    return acc + (baseCost * (1 + (eqInflation / 100)));
  }, 0);
  const eqCost = eqTotalDay / perf;

  // 3. Mano de Obra
  const totJornal = (item.labors || []).reduce((acc, curr) => {
    const q = parseFloat(curr.cantidad ?? curr.quantity ?? 0);
    const j = parseFloat(curr.jornal ?? 0) * exRate;
    const baseCost = q * j;
    return acc + (baseCost * (1 + (labInflation / 100)));
  }, 0);

  const totBono = (item.labors || []).reduce((acc, curr) => {
    const q = parseFloat(curr.cantidad ?? curr.quantity ?? 0);
    const bBonus = parseFloat(curr.bono) || defaultLaborBonus;
    const b = bBonus * exRate;
    const baseCost = q * b;
    return acc + (baseCost * (1 + (labInflation / 100)));
  }, 0);

  const fcasPercent = parseFloat(budget?.fcas_percent ?? 417.0);
  const fcasMonto = totJornal * (fcasPercent / 100);
  const labTotalDay = totJornal + totBono + fcasMonto;
  const labCost = labTotalDay / perf;

  // Overheads: Subtotal A -> Subtotal B -> Subtotal C (Precio Unitario)
  const subtotalA = matCost + eqCost + labCost;
  const adminPercent = parseFloat(budget?.admin_percent ?? 15.0);
  const profitPercent = parseFloat(budget?.profit_percent ?? budget?.util_percent ?? 10.0);

  const adminCost = subtotalA * (adminPercent / 100);
  const subtotalB = subtotalA + adminCost;
  const profitCost = subtotalB * (profitPercent / 100);
  const subtotalC = subtotalB + profitCost;

  return subtotalC;
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
      return sum + (pu * qty);
    }, 0);

  const ivaPercent = parseFloat(budget.iva_percent ?? 16.0);
  const ivaAmount = subtotalPresupuesto * (ivaPercent / 100);
  const totalGeneral = subtotalPresupuesto + ivaAmount;

  return { subtotalPresupuesto, ivaAmount, totalGeneral };
}
