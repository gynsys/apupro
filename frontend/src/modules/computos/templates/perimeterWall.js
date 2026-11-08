/**
 * Plantilla paramétrica: pared perimetral.
 *
 * Genera partidas técnicas en cascada a partir de las dimensiones y el tipo
 * de solución. Las partidas no inventan precios: quedan como filas de cómputo
 * para asociarlas a un APU de la base.
 */

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const round4 = (value) => Math.round((Number(value) || 0) * 10000) / 10000;

export const BLOCK_TYPES = {
  concreto_10: { label: 'Bloque de concreto 10 cm', blocksPerM2: 12.5, mortarPerM2: 0.018, waste: 0.05 },
  concreto_15: { label: 'Bloque de concreto 15 cm', blocksPerM2: 12.5, mortarPerM2: 0.025, waste: 0.05 },
  concreto_20: { label: 'Bloque de concreto 20 cm', blocksPerM2: 12.5, mortarPerM2: 0.035, waste: 0.05 },
  arcilla_10: { label: 'Bloque de arcilla 10 cm', blocksPerM2: 20, mortarPerM2: 0.015, waste: 0.06 },
  arcilla_15: { label: 'Bloque de arcilla 15 cm', blocksPerM2: 20, mortarPerM2: 0.022, waste: 0.06 },
};

export const DEFAULT_WALL_INPUT = {
  length: 20,
  height: 2.7,
  blockType: 'concreto_15',
  includeFoundation: true,
  foundationWidth: 0.4,
  foundationDepth: 0.6,
  includeColumns: true,
  columnSpacing: 3,
  includeRebar: true,
  frisoSides: 2,
  includePaint: false,
  includeConcertina: true,
  includeElectricFence: false,
  includeGate: false,
};

function baseRow(chapter, description, unit, quantity, formula, observations = '') {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? `macro-${crypto.randomUUID()}`
      : `macro-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    chapter,
    description,
    unit,
    quantity: round2(quantity),
    partial: round2(quantity),
    formula,
    observations,
    isDefaultQty: false,
  };
}

export function calculatePerimeterWall(input = {}) {
  const data = { ...DEFAULT_WALL_INPUT, ...input };
  const block = BLOCK_TYPES[data.blockType] || BLOCK_TYPES.concreto_15;
  const length = Math.max(0, Number(data.length) || 0);
  const height = Math.max(0, Number(data.height) || 0);
  const wallArea = length * height;
  const rows = [];
  const chapter = 'PARED PERIMETRAL';

  if (length <= 0 || height <= 0) {
    return { rows, totals: { area: 0, concrete: 0, blocks: 0, rebar: 0 } };
  }

  // Movimiento de tierra y fundación
  if (data.includeFoundation) {
    const foundationWidth = Math.max(0, Number(data.foundationWidth) || 0.4);
    const foundationDepth = Math.max(0, Number(data.foundationDepth) || 0.6);
    const excavation = length * (foundationWidth + 0.2) * (foundationDepth + 0.1);
    const concrete = length * foundationWidth * foundationDepth;
    const formwork = length * 2 * foundationDepth;
    const rebar = data.includeRebar ? concrete * 80 : 0;

    rows.push(baseRow(chapter, 'Excavación para fundación de pared perimetral', 'M3', excavation, `L × (ancho + 0,20) × (profundidad + 0,10)`));
    rows.push(baseRow(chapter, 'Concreto para fundación corrida de pared perimetral', 'M3', concrete, `L × ${foundationWidth} × ${foundationDepth}`));
    rows.push(baseRow(chapter, 'Encofrado de fundación corrida', 'M2', formwork, `L × 2 × ${foundationDepth}`));
    if (rebar > 0) {
      rows.push(baseRow(chapter, 'Acero de refuerzo para fundación', 'KG', rebar, `Volumen de concreto × 80 kg/m3`));
    }
  }

  // Columnas o pilastras
  if (data.includeColumns) {
    const spacing = Math.max(0.5, Number(data.columnSpacing) || 3);
    const columns = Math.max(1, Math.ceil(length / spacing) + 1);
    const columnWidth = 0.2;
    const columnDepth = Math.max(0.2, Number(data.blockType?.includes('20') ? 0.2 : 0.15));
    const columnConcrete = columns * columnWidth * columnDepth * height;
    const columnFormwork = columns * 2 * (columnWidth + columnDepth) * height;
    const columnRebar = data.includeRebar ? columnConcrete * 100 : 0;

    rows.push(baseRow(chapter, `Columnas de concreto para pared perimetral (${columns} und)`, 'M3', columnConcrete, `${columns} × ${columnWidth} × ${columnDepth} × ${height}`));
    rows.push(baseRow(chapter, 'Encofrado de columnas de pared perimetral', 'M2', columnFormwork, `${columns} × 2 × (${columnWidth} + ${columnDepth}) × ${height}`));
    if (columnRebar > 0) {
      rows.push(baseRow(chapter, 'Acero de refuerzo para columnas', 'KG', columnRebar, `Volumen de columnas × 100 kg/m3`));
    }
  }

  // Mampostería
  const blocks = wallArea * block.blocksPerM2 * (1 + block.waste);
  const mortar = wallArea * block.mortarPerM2;
  rows.push(baseRow(chapter, `Pared de ${block.label}`, 'M2', wallArea, `L × H = ${length} × ${height}`, `Bloque: ${block.label}`));
  rows.push(baseRow(chapter, 'Bloques de concreto o arcilla', 'UND', blocks, `Área × ${block.blocksPerM2} und/m2 × (1 + ${block.waste * 100}%)`));
  rows.push(baseRow(chapter, 'Mortero de pega para pared', 'M3', mortar, `Área × ${block.mortarPerM2} m3/m2`));

  // Friso
  if (Number(data.frisoSides) > 0) {
    const friso = wallArea * Number(data.frisoSides);
    rows.push(baseRow(chapter, `Friso de pared (${data.frisoSides} cara${Number(data.frisoSides) > 1 ? 's' : ''})`, 'M2', friso, `Área × ${data.frisoSides}`));
  }

  // Pintura
  if (data.includePaint) {
    rows.push(baseRow(chapter, 'Pintura de pared perimetral', 'M2', wallArea * Math.max(1, Number(data.frisoSides) || 1), `Área × caras`));
  }

  // Seguridad perimetral
  if (data.includeConcertina) {
    rows.push(baseRow(chapter, 'Concertina galvanizada de seguridad', 'ML', length, `Longitud de pared`));
  }
  if (data.includeElectricFence) {
    rows.push(baseRow(chapter, 'Cerco eléctrico perimetral', 'ML', length, `Longitud de pared`));
  }
  if (data.includeGate) {
    rows.push(baseRow(chapter, 'Portón de acceso para pared perimetral', 'UND', 1, `Cantidad`));
  }

  const totals = {
    area: round2(wallArea),
    concrete: round2(rows.filter((r) => r.unit === 'M3').reduce((sum, r) => sum + r.quantity, 0)),
    blocks: round2(blocks),
    rebar: round2(rows.filter((r) => r.unit === 'KG').reduce((sum, r) => sum + r.quantity, 0)),
  };

  return { rows, totals };
}

export const PERIMETER_WALL_TEMPLATE = {
  id: 'pared_perimetral',
  name: 'Pared perimetral',
  description: 'Muro perimetral de bloques con fundación, columnas, friso y seguridad.',
};
