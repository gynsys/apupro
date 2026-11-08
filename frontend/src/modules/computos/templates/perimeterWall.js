/**
 * Plantilla paramétrica: pared perimetral.
 *
 * Calcula en cascada fundación, columnas, mampostería, friso, seguridad y
 * acero con despiece. No inventa precios: genera filas de cómputo editables.
 */

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const round4 = (value) => Math.round((Number(value) || 0) * 10000) / 10000;

// Peso aproximado del acero: kg/m = diámetro² / 162
const rebarKgPerM = (diameterMm) => round4(((Number(diameterMm) || 0) ** 2) / 162);

export const BLOCK_TYPES = {
  concreto_10: {
    label: 'Bloque de concreto 10 cm',
    length: 0.39,
    height: 0.19,
    thickness: 0.10,
    mortarPerM2: 0.018,
    waste: 0.05,
  },
  concreto_15: {
    label: 'Bloque de concreto 15 cm',
    length: 0.39,
    height: 0.19,
    thickness: 0.15,
    mortarPerM2: 0.025,
    waste: 0.05,
  },
  concreto_20: {
    label: 'Bloque de concreto 20 cm',
    length: 0.39,
    height: 0.19,
    thickness: 0.20,
    mortarPerM2: 0.035,
    waste: 0.05,
  },
  arcilla_10: {
    label: 'Bloque de arcilla 10 cm',
    length: 0.30,
    height: 0.20,
    thickness: 0.10,
    mortarPerM2: 0.015,
    waste: 0.06,
  },
  arcilla_15: {
    label: 'Bloque de arcilla 15 cm',
    length: 0.30,
    height: 0.20,
    thickness: 0.15,
    mortarPerM2: 0.022,
    waste: 0.06,
  },
};

export const DEFAULT_WALL_INPUT = {
  length: 20,
  height: 2.7,
  blockType: 'concreto_15',
  joint: 0.015,

  includeFoundation: true,
  foundationWidth: 0.4,
  foundationDepth: 0.6,
  includeColumns: true,
  columnSpacing: 3,

  // Acero: despiece real
  includeRebar: true,
  foundationBarCount: 4,
  foundationBarDiameter: 12,
  foundationStirrupSpacing: 0.20,
  foundationStirrupDiameter: 8,
  columnBarCount: 4,
  columnBarDiameter: 12,
  columnStirrupSpacing: 0.15,
  columnStirrupDiameter: 8,

  // Huecos
  includeGate: false,
  gateCount: 1,
  gateWidth: 3,
  gateHeight: 2.2,
  windowsCount: 0,
  windowWidth: 1,
  windowHeight: 1,

  // Acabados
  frisoSides: 2,
  includePaint: false,
  includeConcertina: true,
  includeElectricFence: false,
};

function baseRow(key, chapter, description, unit, quantity, formula, observations = '') {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? `macro-${crypto.randomUUID()}`
      : `macro-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    key,
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

function blocksPerSquareMeter(block, joint) {
  const moduleLength = block.length + joint;
  const moduleHeight = block.height + joint;
  return moduleLength > 0 && moduleHeight > 0 ? 1 / (moduleLength * moduleHeight) : 0;
}

export function calculatePerimeterWall(input = {}) {
  const data = { ...DEFAULT_WALL_INPUT, ...input };
  const block = BLOCK_TYPES[data.blockType] || BLOCK_TYPES.concreto_15;
  const length = Math.max(0, Number(data.length) || 0);
  const height = Math.max(0, Number(data.height) || 0);
  const grossArea = length * height;
  const rows = [];
  const chapter = 'PARED PERIMETRAL';
  const columns = data.includeColumns
    ? Math.max(1, Math.ceil(length / Math.max(0.5, Number(data.columnSpacing) || 3)) + 1)
    : 0;
  const columnWidth = 0.20;
  const columnDepth = Math.max(0.15, block.thickness);
  const gateCount = data.includeGate ? Math.max(0, Number(data.gateCount) || 1) : 0;
  const windowsCount = Math.max(0, Number(data.windowsCount) || 0);
  const gateArea = gateCount * Math.max(0, Number(data.gateWidth) || 0) * Math.max(0, Number(data.gateHeight) || 0);
  const windowArea = windowsCount * Math.max(0, Number(data.windowWidth) || 0) * Math.max(0, Number(data.windowHeight) || 0);
  const openingArea = gateArea + windowArea;
  const netArea = Math.max(0, grossArea - openingArea);
  const joint = Math.max(0, Number(data.joint) || 0.015);
  const blocksPerM2 = blocksPerSquareMeter(block, joint);

  if (length <= 0 || height <= 0) {
    return {
      rows,
      totals: {
        area: 0,
        grossArea: 0,
        openings: 0,
        concrete: 0,
        blocks: 0,
        rebar: 0,
        columns: 0,
      },
    };
  }

  if (data.includeFoundation) {
    const foundationWidth = Math.max(0, Number(data.foundationWidth) || 0.4);
    const foundationDepth = Math.max(0, Number(data.foundationDepth) || 0.6);
    const excavation = length * (foundationWidth + 0.20) * (foundationDepth + 0.10);
    const concrete = length * foundationWidth * foundationDepth;
    const formwork = length * 2 * foundationDepth;

    rows.push(baseRow('foundation_excavation', chapter, 'Excavación para fundación de pared perimetral', 'M3', excavation, 'L × (ancho + 0,20) × (profundidad + 0,10)'));
    rows.push(baseRow('foundation_concrete', chapter, 'Concreto para fundación corrida de pared perimetral', 'M3', concrete, `L × ${foundationWidth} × ${foundationDepth}`));
    rows.push(baseRow('foundation_formwork', chapter, 'Encofrado de fundación corrida', 'M2', formwork, `L × 2 × ${foundationDepth}`));

    if (data.includeRebar) {
      const longitudinalBars = Math.max(1, Number(data.foundationBarCount) || 4);
      const longitudinalDiameter = Math.max(6, Number(data.foundationBarDiameter) || 12);
      const longitudinalLength = length + 1.0; // empalmes y anclajes
      const longitudinalKg = longitudinalBars * longitudinalLength * rebarKgPerM(longitudinalDiameter);

      const stirrupSpacing = Math.max(0.10, Number(data.foundationStirrupSpacing) || 0.20);
      const stirrupDiameter = Math.max(6, Number(data.foundationStirrupDiameter) || 8);
      const stirrupCount = Math.ceil(length / stirrupSpacing) + 1;
      const stirrupLength = 2 * (foundationWidth + foundationDepth) + 0.20;
      const stirrupKg = stirrupCount * stirrupLength * rebarKgPerM(stirrupDiameter);

      rows.push(baseRow('foundation_rebar_long', chapter, 'Acero longitudinal de fundación', 'KG', longitudinalKg, `${longitudinalBars} Ø${longitudinalDiameter} mm × ${round2(longitudinalLength)} m × ${rebarKgPerM(longitudinalDiameter)} kg/m`));
      rows.push(baseRow('foundation_rebar_stirrups', chapter, 'Estribos de fundación', 'KG', stirrupKg, `${stirrupCount} estribos × ${round2(stirrupLength)} m × Ø${stirrupDiameter} mm`));
    }
  }

  if (data.includeColumns) {
    const columnConcrete = columns * columnWidth * columnDepth * height;
    const columnFormwork = columns * 2 * (columnWidth + columnDepth) * height;
    rows.push(baseRow('columns_concrete', chapter, `Columnas de concreto para pared perimetral (${columns} und)`, 'M3', columnConcrete, `${columns} × ${columnWidth} × ${columnDepth} × ${height}`));
    rows.push(baseRow('columns_formwork', chapter, 'Encofrado de columnas de pared perimetral', 'M2', columnFormwork, `${columns} × 2 × (${columnWidth} + ${columnDepth}) × ${height}`));

    if (data.includeRebar) {
      const verticalBars = Math.max(1, Number(data.columnBarCount) || 4);
      const verticalDiameter = Math.max(6, Number(data.columnBarDiameter) || 12);
      const verticalLength = height + 0.5;
      const verticalKg = columns * verticalBars * verticalLength * rebarKgPerM(verticalDiameter);

      const stirrupSpacing = Math.max(0.10, Number(data.columnStirrupSpacing) || 0.15);
      const stirrupDiameter = Math.max(6, Number(data.columnStirrupDiameter) || 8);
      const stirrupCountPerColumn = Math.ceil(height / stirrupSpacing) + 1;
      const stirrupLength = 2 * (columnWidth + columnDepth) + 0.20;
      const stirrupKg = columns * stirrupCountPerColumn * stirrupLength * rebarKgPerM(stirrupDiameter);

      rows.push(baseRow('columns_rebar_vertical', chapter, 'Acero vertical de columnas', 'KG', verticalKg, `${columns} columnas × ${verticalBars} Ø${verticalDiameter} mm × ${round2(verticalLength)} m`));
      rows.push(baseRow('columns_rebar_stirrups', chapter, 'Estribos de columnas', 'KG', stirrupKg, `${columns} × ${stirrupCountPerColumn} estribos × ${round2(stirrupLength)} m × Ø${stirrupDiameter} mm`));
    }
  }

  const blocks = netArea * blocksPerM2 * (1 + block.waste);
  const mortar = netArea * block.mortarPerM2;
  rows.push(baseRow('wall', chapter, `Pared de ${block.label}`, 'M2', netArea, `Área bruta ${round2(grossArea)} - huecos ${round2(openingArea)}`, `Bloque: ${block.label} · espesor ${block.thickness * 100} cm`));
  rows.push(baseRow('blocks', chapter, 'Bloques de concreto o arcilla', 'UND', blocks, `Área neta × ${round4(blocksPerM2)} und/m2 × (1 + ${block.waste * 100}%)`, `Incluye junta de ${joint * 100} cm`));
  rows.push(baseRow('mortar', chapter, 'Mortero de pega para pared', 'M3', mortar, `Área neta × ${block.mortarPerM2} m3/m2`));

  if (Number(data.frisoSides) > 0) {
    const friso = netArea * Number(data.frisoSides);
    rows.push(baseRow('friso', chapter, `Friso de pared (${data.frisoSides} cara${Number(data.frisoSides) > 1 ? 's' : ''})`, 'M2', friso, `Área neta × ${data.frisoSides}`));
  }

  if (data.includePaint) {
    rows.push(baseRow('paint', chapter, 'Pintura de pared perimetral', 'M2', netArea * Math.max(1, Number(data.frisoSides) || 1), 'Área neta × caras'));
  }

  if (data.includeConcertina) {
    rows.push(baseRow('concertina', chapter, 'Concertina galvanizada de seguridad', 'ML', length, 'Longitud de pared'));
  }
  if (data.includeElectricFence) {
    rows.push(baseRow('electric_fence', chapter, 'Cerco eléctrico perimetral', 'ML', length, 'Longitud de pared'));
  }
  if (gateCount > 0) {
    rows.push(baseRow('gate', chapter, 'Portón de acceso para pared perimetral', 'UND', gateCount, `Cantidad: ${gateCount}`));
  }

  const totals = {
    area: round2(netArea),
    grossArea: round2(grossArea),
    openings: round2(openingArea),
    concrete: round2(rows.filter((row) => row.unit === 'M3').reduce((sum, row) => sum + row.quantity, 0)),
    blocks: round2(blocks),
    rebar: round2(rows.filter((row) => row.unit === 'KG').reduce((sum, row) => sum + row.quantity, 0)),
    columns,
  };

  return { rows, totals };
}

export const PERIMETER_WALL_TEMPLATE = {
  id: 'pared_perimetral',
  name: 'Pared perimetral',
  description: 'Muro perimetral de bloques con fundación, columnas, friso y seguridad.',
};
