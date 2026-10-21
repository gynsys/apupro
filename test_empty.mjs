import fs from 'fs';
import { calculateItemPU } from './frontend/src/utils/apuCalculations.js';

for (const file of ['budget_0efa568a.json', 'budget_dc7d17bd.json']) {
  if (!fs.existsSync(file)) continue;
  const budget = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\nTesting ${file}:`);
  budget.items.forEach((item, idx) => {
    if (item.is_chapter) return;
    const pu_empty = calculateItemPU(item, {});
    const pu_budget = calculateItemPU(item, budget);
    if (Math.abs(pu_empty - 224.67) < 0.1 || Math.abs(pu_budget - 224.67) < 0.1) {
      console.log(`FOUND 224.67! Item #${idx+1} (${item.cov_par}): pu_empty=${pu_empty}, pu_budget=${pu_budget}`);
    }
  });
}
console.log("Done testing empty budget.");
