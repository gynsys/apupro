import fs from 'fs';
import { calculateItemPU } from './frontend/src/utils/apuCalculations.js';

for (const bname of ['budget_dc7d17bd.json', 'budget_0efa568a.json']) {
  const b = JSON.parse(fs.readFileSync(bname, 'utf8'));
  const it = b.items[0];
  console.log(`\n=== Item 1 in ${bname} ===`);
  console.log(`Item perf: ${it.performance}, Budget FCAS: ${b.fcas_percent}, Admin: ${b.admin_percent}, Profit: ${b.profit_percent}, bono_in_fcas: ${b.bono_in_fcas}`);
  
  // calculateItemPU with b
  const pu_budget = calculateItemPU(it, b);
  console.log(`calculateItemPU(it, b): ${pu_budget}`);

  // what if b is default/empty?
  const pu_empty = calculateItemPU(it, {});
  console.log(`calculateItemPU(it, {}): ${pu_empty}`);

  // what if fcas=417?
  const pu_417 = calculateItemPU(it, { ...b, fcas_percent: 417 });
  console.log(`calculateItemPU(it, fcas=417): ${pu_417}`);

  // what if fcas=0?
  const pu_0 = calculateItemPU(it, { ...b, fcas_percent: 0 });
  console.log(`calculateItemPU(it, fcas=0): ${pu_0}`);
}
