import fs from 'fs';

for (const file of ['budget_0efa568a.json', 'budget_dc7d17bd.json']) {
  if (!fs.existsSync(file)) continue;
  const budget = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\nBrute-forcing ${file}...`);

  for (const item of budget.items) {
    if (item.is_chapter) continue;
    
    // Vary settings
    const adminVals = [0, 10, 12, 15, 20];
    const profitVals = [0, 5, 10, 15];
    const fcasVals = [0, 100, 200, 300, 400, 417, 500, 700, 1000, 1100, 1200];
    const perfVals = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, item.performance || 1];
    const bonoInFcasVals = [true, false];
    const exVals = [1.0, 36.5, 40.0, 50.0];

    for (const admin of adminVals) {
      for (const profit of profitVals) {
        for (const fcas of fcasVals) {
          for (const perf of perfVals) {
            for (const bonoInFcas of bonoInFcasVals) {
              for (const ex of exVals) {
                // calculate
                const matCost = (item.materials || []).reduce((acc, m) => {
                  const q = m.cantidad || 0;
                  const p = (m.precio_unitario || 0) * ex;
                  const w = m.desperdicio || 0;
                  return acc + q * p * (1 + w / 100);
                }, 0);

                const eqCost = (item.equipments || []).reduce((acc, e) => {
                  const q = e.cantidad || 0;
                  const p = (e.precio_unitario || 0) * ex;
                  const d = e.depreciacion ?? 1.0;
                  return acc + q * p * d;
                }, 0) / perf;

                const totJornal = (item.labors || []).reduce((acc, l) => {
                  return acc + (l.cantidad || 0) * (l.jornal || 0) * ex;
                }, 0);

                const totBono = bonoInFcas ? 0 : (item.labors || []).reduce((acc, l) => {
                  return acc + (l.cantidad || 0) * (l.bono || 0) * ex;
                }, 0);

                const fcasMonto = totJornal * (fcas / 100);
                const labCost = (totJornal + totBono + fcasMonto) / perf;

                const subA = matCost + eqCost + labCost;
                const subB = subA * (1 + admin / 100);
                const subC = subB * (1 + profit / 100);
                const pu = Math.round((subC + Number.EPSILON) * 100) / 100;

                if (pu === 224.67 || Math.abs(pu - 224.67) < 0.005) {
                  console.log(`FOUND EXACT 224.67! Item: ${item.cov_par} "${item.description.slice(0, 30)}"`);
                  console.log(`  Admin=${admin}, Profit=${profit}, FCAS=${fcas}, Perf=${perf}, BonoInFcas=${bonoInFcas}, Ex=${ex}`);
                  console.log(`  matCost=${matCost}, eqCost=${eqCost}, labCost=${labCost}, subA=${subA}`);
                }
              }
            }
          }
        }
      }
    }
  }
}
console.log("Brute-force finished.");
