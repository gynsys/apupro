import fs from 'fs';

const b = JSON.parse(fs.readFileSync('budget_dc7d17bd.json', 'utf8'));
const it = b.items[0];
console.log('Item 1 in dc7d17bd:');
console.log('id:', it.id);
console.log('cov:', it.cov_par);
console.log('perf:', it.performance);
console.log('materials:', it.materials);
console.log('equipments:', it.equipments);
console.log('labors:', it.labors);
