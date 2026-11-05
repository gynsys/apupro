/**
 * Módulo de Plantillas de Geometría Inteligente para la Planilla de Cómputos Métricos.
 * 
 * Permite calcular figuras más allá del prisma rectangular tradicional (L × A × H):
 * 1. Cilindro / Pilote / Columna Circular
 * 2. Sección Triangular / Talud / Cubierta a 2 Aguas
 * 3. Zapata Troncocónica / Piramidal
 * 4. Zanja y Tubería (Excavación + Cama de arena + Relleno compactado)
 */

export const GEOMETRY_TYPES = {
  RECTANGLE: 'rectangle',
  CYLINDER: 'cylinder',
  TRIANGLE: 'triangle',
  TRUNCATED_PYRAMID: 'truncated_pyramid',
  TRENCH: 'trench',
};

export const GEOMETRY_CONFIGS = [
  {
    id: GEOMETRY_TYPES.RECTANGLE,
    label: 'Prisma Rectangular (L × A × H)',
    shortLabel: 'Prisma',
    icon: '📦',
    description: 'Largo × Ancho × Alto tradicional',
  },
  {
    id: GEOMETRY_TYPES.CYLINDER,
    label: 'Cilindro / Pilote / Columna Circular',
    shortLabel: 'Cilindro',
    icon: '⚪',
    description: 'Diámetro ∅ y Altura H (V = π·D²/4 · H)',
  },
  {
    id: GEOMETRY_TYPES.TRIANGLE,
    label: 'Triángulo / Talud / 2 Aguas',
    shortLabel: 'Triángulo',
    icon: '📐',
    description: 'Base × Altura / 2 × Longitud',
  },
  {
    id: GEOMETRY_TYPES.TRUNCATED_PYRAMID,
    label: 'Zapata Troncocónica / Piramidal',
    shortLabel: 'Piramidal',
    icon: '🏛️',
    description: 'H/3 · (A₁ + A₂ + √(A₁·A₂))',
  },
  {
    id: GEOMETRY_TYPES.TRENCH,
    label: 'Zanja / Tubería (Excavación + Cama + Relleno)',
    shortLabel: 'Zanja',
    icon: '⛏️',
    description: 'Longitud, Ancho y Profundidad con desglose de cama y relleno',
  },
];

function round2(val) {
  if (val === null || val === undefined || isNaN(val) || val === '') return 0;
  return Math.round(Number(val) * 100) / 100;
}

function parseNum(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

/**
 * Calcula la base geométrica (1 unidad/vez) para una figura según sus parámetros y la unidad de la partida
 * @param {Object} row - Fila o parcial con campos geométricos
 * @param {string} unit - Unidad de medida (M3, M2, ML, etc.)
 * @returns {{ baseGeom: number, formulaStr: string, trenchDetails?: Object }}
 */
export function computeGeometryBase(row, unit = 'M3') {
  const geomType = row.geometryType || GEOMETRY_TYPES.RECTANGLE;
  const normUnit = String(unit || '').trim().toUpperCase();

  switch (geomType) {
    case GEOMETRY_TYPES.CYLINDER: {
      // row.length actúa como Diámetro Ø (m), row.height como Altura H (m)
      const d = parseNum(row.diameter ?? row.length);
      const h = parseNum(row.height);

      if (d !== null && d > 0) {
        if (normUnit === 'M2') {
          // Área lateral del cilindro (encofrado o pintura): π · D · H
          const heightVal = h !== null && h > 0 ? h : 1;
          const area = Math.PI * d * heightVal;
          const formulaStr = h !== null && h > 0
            ? `π · (${d}m) × ${h}m`
            : `π · (${d}m)`;
          return { baseGeom: round2(area), formulaStr };
        } else if (normUnit === 'M' || normUnit === 'ML') {
          // Perímetro circular: π · D
          const perim = Math.PI * d;
          return { baseGeom: round2(perim), formulaStr: `π · (${d}m)` };
        } else {
          // Volumen del cilindro (M3): π · D² / 4 · H
          const heightVal = h !== null && h > 0 ? h : 1;
          const vol = (Math.PI * Math.pow(d, 2) / 4) * heightVal;
          const formulaStr = `π · (${d}m)² / 4${h !== null && h > 0 ? ` × ${h}m` : ''}`;
          return { baseGeom: round2(vol), formulaStr };
        }
      }
      break;
    }

    case GEOMETRY_TYPES.TRIANGLE: {
      // row.length actúa como Base (m), row.width como Altura del triángulo (m), row.height como Largo del tramo (m)
      const base = parseNum(row.triangleBase ?? row.length);
      const hTri = parseNum(row.triangleHeight ?? row.width);
      const length = parseNum(row.height);

      if (base !== null && base > 0 && hTri !== null && hTri > 0) {
        const areaTri = (base * hTri) / 2;
        if (normUnit === 'M2') {
          return {
            baseGeom: round2(areaTri),
            formulaStr: `(${base}m × ${hTri}m) / 2`,
          };
        }
        // Volumen M3 = Área triángulo * Largo
        const lenVal = length !== null && length > 0 ? length : 1;
        const vol = areaTri * lenVal;
        const formulaStr = length !== null && length > 0
          ? `((${base}m × ${hTri}m) / 2) × ${length}m`
          : `(${base}m × ${hTri}m) / 2`;
        return { baseGeom: round2(vol), formulaStr };
      }
      break;
    }

    case GEOMETRY_TYPES.TRUNCATED_PYRAMID: {
      // row.length = Lado base mayor L1 (m), row.width = Lado base menor L2 (m), row.height = Altura H (m)
      // O si se especifican áreas A1 y A2 directamente
      const l1 = parseNum(row.baseMajor ?? row.length);
      const l2 = parseNum(row.baseMinor ?? row.width);
      const h = parseNum(row.height);

      if (l1 !== null && l1 > 0 && h !== null && h > 0) {
        const a1 = Math.pow(l1, 2);
        const a2 = l2 !== null && l2 > 0 ? Math.pow(l2, 2) : 0;
        // Fórmula de zapata piramidal / tronco de pirámide: H/3 * (A1 + A2 + sqrt(A1 * A2))
        const vol = (h / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
        const formulaStr = `${h}m/3 · [${round2(a1)} + ${round2(a2)} + √(${round2(a1)}·${round2(a2)})]`;
        return { baseGeom: round2(vol), formulaStr };
      }
      break;
    }

    case GEOMETRY_TYPES.TRENCH: {
      // row.length = Longitud L (m), row.width = Ancho A (m), row.height = Profundidad H (m)
      const l = parseNum(row.length);
      const w = parseNum(row.width);
      const h = parseNum(row.height);
      const pipeDiam = parseNum(row.trenchPipeDiameter ?? row.pipeDiameter); // m
      const bedH = parseNum(row.trenchBeddingHeight ?? row.beddingHeight); // m

      if (l !== null && l > 0 && w !== null && w > 0 && h !== null && h > 0) {
        const vExc = round2(l * w * h);
        const vBed = bedH !== null && bedH > 0 ? round2(l * w * bedH) : 0;
        const vPipe = pipeDiam !== null && pipeDiam > 0 ? round2((Math.PI * Math.pow(pipeDiam, 2) / 4) * l) : 0;
        const vBackfill = Math.max(0, round2(vExc - vBed - vPipe));

        const trenchDetails = {
          excavationM3: vExc,
          beddingM3: vBed,
          pipeM3: vPipe,
          backfillM3: vBackfill,
        };

        // Si la partida específica es Cama de arena o Relleno, podemos retornar el valor correspondiente
        const descUpper = String(row.description || '').toUpperCase();
        let activeVol = vExc;
        let label = 'Excavación';
        if (descUpper.includes('CAMA') || descUpper.includes('ARENA')) {
          activeVol = vBed > 0 ? vBed : vExc;
          label = 'Cama';
        } else if (descUpper.includes('RELLENO') || descUpper.includes('COMPACTADO')) {
          activeVol = vBackfill > 0 ? vBackfill : vExc;
          label = 'Relleno';
        }

        const formulaStr = `${l}m × ${w}m × ${h}m (${label}: ${activeVol}m³)`;
        return { baseGeom: activeVol, formulaStr, trenchDetails };
      }
      break;
    }

    case GEOMETRY_TYPES.RECTANGLE:
    default:
      // Se maneja en formulas.js estándar
      break;
  }

  return { baseGeom: null, formulaStr: '' };
}
