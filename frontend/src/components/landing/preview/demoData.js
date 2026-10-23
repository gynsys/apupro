export const demoBudgets = [
  {
    id: 1,
    name: 'Rehabilitación de áreas internas',
    client: 'BAER',
    items: 88,
    total: '$ 210.952,94',
  },
  {
    id: 2,
    name: 'Muro de gaviones L=35 m',
    client: 'Gobernación',
    items: 14,
    total: '$ 20.626,19',
  },
];

export const demoPartidas = [
  { code: '1', description: 'Instalaciones provisionales', unit: 'und', qty: 1, pu: '$ 1.293,88', isChapter: true },
  { code: '2', description: 'Remoción de manto asfáltico', unit: 'm2', qty: 120, pu: '$ 8,42' },
  { code: '3', description: 'Sobrepiso nivelado de cemento', unit: 'm2', qty: 64, pu: '$ 18,15' },
  { code: '4', description: 'Impermeabilización transitable', unit: 'm2', qty: 42, pu: '$ 24,70' },
  { code: '5', description: 'Pintura elastomérica para techos', unit: 'm2', qty: 180, pu: '$ 9,35' },
  { code: '6', description: 'Reparación de drenajes de lluvia', unit: 'und', qty: 8, pu: '$ 76,20' },
  { code: '7', description: 'Suministro de pintura base', unit: 'gln', qty: 12, pu: '$ 14,80' },
  { code: '8', description: 'Limpieza final de la zona', unit: 'm2', qty: 180, pu: '$ 1,25' },
  { code: '9', description: 'Pruebas y entrega de obra', unit: 'glb', qty: 1, pu: '$ 320,00' },
  { code: '10', description: 'Andamio tubular para fachada', unit: 'm2', qty: 36, pu: '$ 6,80' },
  { code: '11', description: 'Sellado de juntas perimetrales', unit: 'ml', qty: 48, pu: '$ 3,40' },
  { code: '12', description: 'Retiro de escombros', unit: 'm3', qty: 12, pu: '$ 18,60' },
  { code: '13', description: 'Colocación de malla de refuerzo', unit: 'm2', qty: 36, pu: '$ 4,25' },
  { code: '14', description: 'Revisión de pendientes de techo', unit: 'm2', qty: 180, pu: '$ 0,95' },
  { code: '15', description: 'Sellador primario para concreto', unit: 'gln', qty: 8, pu: '$ 11,20' },
  { code: '16', description: 'Señalización y protección de área', unit: 'glb', qty: 1, pu: '$ 145,00' },
];

export const demoMaterials = [
  { code: 'PIN018', description: 'Pintura de caucho tipo A Montana', unit: 'gln', qty: 0.04, price: '$ 43,40', total: '$ 1,74' },
  { code: 'MT208', description: 'Placa plástica para tomacorriente', unit: 'pza', qty: 1, price: '$ 1,15', total: '$ 1,15' },
  { code: 'PIN191', description: 'Cepillo y haragán para impermeabilizar', unit: 'und', qty: 1, price: '$ 0,45', total: '$ 0,45' },
  { code: 'VAL026', description: 'Flete / transporte por metro lineal', unit: 'm', qty: 1, price: '$ 2,47', total: '$ 2,47' },
];

export const demoEquipment = [
  { code: 'HER140', description: 'Esmeril portátil / manual 4 1/2"', qty: 1, deprec: 0.005, price: '$ 55,00', total: '$ 0,28' },
  { code: 'ALB003', description: 'Carretilla cap= 110 lt ruedas de goma', qty: 1, deprec: 0.02, price: '$ 45,00', total: '$ 0,90' },
];

export const demoLabor = [
  { code: 'MAO001', description: 'Maestro de obra', qty: 0.05, jornal: '$ 25,00', total: '$ 1,25' },
  { code: 'AYU002', description: 'Ayudante de construcción', qty: 0.10, jornal: '$ 12,50', total: '$ 1,25' },
];

// Datos estáticos para renderizar el mismo ApuEditorUI que usa la plataforma.
export const demoApuItem = {
  id: 'demo-apu-5',
  cod_par: '5',
  description: 'Pintura elastomérica para techos',
  unit: 'm2',
  performance: 1,
  quantity: 180,
  materials: [
    { id: 'demo-mat-1', codigo: 'PIN018', descripcion: 'Pintura de caucho tipo A Montana', unidad: 'gln', cantidad: 0.04, precio_unitario: 43.4, desperdicio: 0 },
    { id: 'demo-mat-2', codigo: 'MT208', descripcion: 'Placa plástica para tomacorriente', unidad: 'pza', cantidad: 1, precio_unitario: 1.15, desperdicio: 0 },
    { id: 'demo-mat-3', codigo: 'PIN191', descripcion: 'Cepillo y haragán para impermeabilizar', unidad: 'und', cantidad: 1, precio_unitario: 0.45, desperdicio: 0 },
    { id: 'demo-mat-4', codigo: 'VAL026', descripcion: 'Flete / transporte por metro lineal', unidad: 'm', cantidad: 1, precio_unitario: 2.47, desperdicio: 0 },
    { id: 'NEW-DEMO-M', codigo: '', descripcion: '', unidad: 'und', cantidad: 1, precio_unitario: 0, desperdicio: 0 },
  ],
  equipments: [
    { id: 'demo-eq-1', codigo: 'HER140', descripcion: 'Esmeril portátil / manual 4 1/2"', unidad: 'und', cantidad: 1, precio_unitario: 55, depreciacion: 0.005 },
    { id: 'demo-eq-2', codigo: 'ALB003', descripcion: 'Carretilla cap= 110 lt ruedas de goma', unidad: 'und', cantidad: 1, precio_unitario: 45, depreciacion: 0.02 },
    { id: 'NEW-DEMO-E', codigo: '', descripcion: '', unidad: 'und', cantidad: 1, precio_unitario: 0, depreciacion: 1 },
  ],
  labors: [
    { id: 'demo-lab-1', codigo: 'MAO001', descripcion: 'Maestro de obra', unidad: 'und', cantidad: 0.05, jornal: 25, bono: 0 },
    { id: 'demo-lab-2', codigo: 'AYU002', descripcion: 'Ayudante de construcción', unidad: 'und', cantidad: 0.1, jornal: 12.5, bono: 0 },
    { id: 'NEW-DEMO-L', codigo: '', descripcion: '', unidad: 'und', cantidad: 1, jornal: 0, bono: 0 },
  ],
};

export const demoApuSettings = {
  currency: 'USD',
  exchange_rate: 1,
  material_inflation: 0,
  equipment_inflation: 0,
  labor_inflation: 0,
  labor_bonus: 0,
  fcas_percent: 417,
  bono_in_fcas: false,
  admin_percent: 15,
  profit_percent: 10,
  iva_percent: 0,
};
