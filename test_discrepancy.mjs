import fs from 'fs';
import { calculateItemPU, calculateBudgetTotals } from './frontend/src/utils/apuCalculations.js';

function calcApuEditorCostos(item, budget) {
  const settings = {
    currency: budget.currency,
    exchange_rate: budget.exchange_rate || 1.0,
    material_inflation: budget.material_inflation || 0,
    equipment_inflation: budget.equipment_inflation || 0,
    labor_inflation: budget.labor_inflation || 0,
    labor_bonus: budget.labor_bonus || 0,
    fcas_percent: budget.fcas_percent || 417,
    admin_percent: budget.admin_percent || 15,
    profit_percent: budget.profit_percent || 10,
    iva_percent: 0,
    bono_in_fcas: budget.bono_in_fcas
  };

  const {
    currency = 'USD',
    exchange_rate = 1.0,
    material_inflation = 0,
    equipment_inflation = 0,
    labor_inflation = 0,
    labor_bonus = 0,
    fcas_percent = 417,
    bono_in_fcas,
    admin_percent = 15,
    profit_percent = 10,
    iva_percent = 0
  } = settings;

  const isBonoInFcas = bono_in_fcas === true || (bono_in_fcas !== false && fcas_percent >= 1000);
  const exRate = currency === 'BS' ? (exchange_rate || 1.0) : 1.0;

  const calculateMaterialTotal = () => {
    return item.materials?.reduce((sum, mat) => {
      const baseCost = mat.cantidad * (mat.precio_unitario * exRate) * (1 + (mat.desperdicio || 0) / 100);
      return sum + (baseCost * (1 + (material_inflation / 100)));
    }, 0) || 0;
  };

  const calculateEquipmentTotalDay = () => {
    return item.equipments?.reduce((sum, eq) => {
      const baseCost = eq.cantidad * (eq.depreciacion ?? 1.0) * (eq.precio_unitario * exRate);
      return sum + (baseCost * (1 + (equipment_inflation / 100)));
    }, 0) || 0;
  };

  const calculateLaborTotalJornalDay = () => {
    return item.labors?.reduce((sum, lab) => {
      const baseCost = lab.cantidad * (lab.jornal * exRate);
      return sum + (baseCost * (1 + (labor_inflation / 100)));
    }, 0) || 0;
  };

  const calculateLaborTotalBonoDay = () => {
    if (isBonoInFcas) return 0;
    return item.labors?.reduce((sum, lab) => {
      const bBonus = lab.bono || labor_bonus || 0;
      const baseCost = lab.cantidad * (bBonus * exRate);
      return sum + (baseCost * (1 + (labor_inflation / 100)));
    }, 0) || 0;
  };

  const calculateLaborTotalDay = () => {
    const totJornal = calculateLaborTotalJornalDay();
    const totBono = calculateLaborTotalBonoDay();
    const fcasMonto = totJornal * (fcas_percent / 100);
    return totJornal + totBono + fcasMonto;
  };

  const matTotal = calculateMaterialTotal();
  const perf = item.performance || item.rendimiento || 1;
  const eqTotal = calculateEquipmentTotalDay() / perf;
  const labTotal = calculateLaborTotalDay() / perf;

  const subtotalA = matTotal + eqTotal + labTotal;
  const adminCost = subtotalA * (admin_percent / 100);
  const subtotalB = subtotalA + adminCost;
  const profitCost = subtotalB * (profit_percent / 100);

  const subtotalC = subtotalB + profitCost;
  return subtotalC;
}

for (const file of ['budget_0efa568a.json', 'budget_dc7d17bd.json']) {
  if (!fs.existsSync(file)) continue;
  const budget = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\n=================== CHECKING ${file} (${budget.name.slice(0, 30)}) ===================`);
  console.log(`Settings: FCAS=${budget.fcas_percent}, Admin=${budget.admin_percent}, Profit=${budget.profit_percent}, bono_in_fcas=${budget.bono_in_fcas}`);

  let diffCount = 0;
  budget.items.forEach((item, idx) => {
    if (item.is_chapter) return;
    const puUtility = calculateItemPU(item, budget);
    const puEditor = calcApuEditorCostos(item, budget);
    const puEditorRounded = Math.round((puEditor + Number.EPSILON) * 100) / 100;
    
    // Check if 224.67 is anywhere
    if (Math.abs(puUtility - 224.67) < 0.1 || Math.abs(puEditor - 224.67) < 0.1 || puUtility.toFixed(2) === '224.67' || puEditor.toFixed(2) === '224.67') {
      console.log(`*** MATCH 224.67 on Item #${idx+1} (${item.cov_par}): PU_util=${puUtility}, PU_editor=${puEditor.toFixed(2)}, desc=${item.description.slice(0, 40)}`);
    }

    if (Math.abs(puUtility - puEditorRounded) > 0.01) {
      diffCount++;
      console.log(`DISCREPANCY on Item #${idx+1} (${item.cov_par}): PU_util=${puUtility} vs PU_editor=${puEditor.toFixed(2)} (diff=${(puUtility - puEditor).toFixed(4)})`);
    }
  });
  console.log(`Total discrepancies between calculateItemPU and ApuEditorUI: ${diffCount}`);
}
