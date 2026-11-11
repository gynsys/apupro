/**
 * Módulo de Plantillas de Geometría Inteligente para la Planilla de Cómputos Métricos.
 * 
 * Permite calcular figuras más allá del prisma rectangular tradicional (L × A × H):
 * 1. Cilindro / Pilote / Columna Circular (con constante 3.1416 explícita y división / 4)
 * 2. Sección Triangular / Talud / Cubierta a 2 Aguas (con división / 2 explícita)
 * 3. Trapecio / Canal / Talud Trapecial (((Base Mayor + Base Menor) × Altura / 2) × Longitud)
 * 4. Zapata Troncocónica / Piramidal (con división / 3 y raíz cuadrada explícita)
 * 5. Zanja y Tubería (Excavación + Cama de arena + Relleno compactado)
 */

export const GEOMETRY_TYPES = {
  RECTANGLE: 'rectangle',
  PRISM: 'prism',
  CYLINDER: 'cylinder',
  TRIANGLE: 'triangle',
  TRIANGLE_3_SIDES: 'triangle_3_sides',
  TRAPEZOID: 'trapezoid',
  TRUNCATED_PYRAMID: 'truncated_pyramid',
  TRENCH: 'trench',
};

export function getDefaultGeometryType(unit = '') {
  return String(unit || '').trim().toUpperCase() === 'M3'
    ? GEOMETRY_TYPES.PRISM
    : GEOMETRY_TYPES.RECTANGLE;
}

export function isBoxGeometry(geometryType) {
  return !geometryType || geometryType === GEOMETRY_TYPES.RECTANGLE || geometryType === GEOMETRY_TYPES.PRISM;
}

export const GEOMETRY_CONFIGS = [
  {
    id: GEOMETRY_TYPES.RECTANGLE,
    label: 'Rectángulo / Área (Largo × Ancho o Alto)',
    shortLabel: 'Rectángulo',
    icon: '▭',
    description: 'Largo × Ancho o Alto tradicional en m²',
  },
  {
    id: GEOMETRY_TYPES.PRISM,
    label: 'Prisma Rectangular (L × A × H)',
    shortLabel: 'Prisma',
    icon: '📦',
    description: 'Largo × Ancho × Alto tradicional en m³',
  },
  {
    id: GEOMETRY_TYPES.CYLINDER,
    label: 'Cilindro / Pilote / Columna Circular',
    shortLabel: 'Cilindro',
    icon: '⚪',
    description: 'Diámetro ∅ y Altura H ((3.1416 × D² / 4) × H)',
  },
  {
    id: GEOMETRY_TYPES.TRIANGLE,
    label: 'Triángulo (Base × Altura / 2)',
    shortLabel: 'Triángulo (B×H)',
    icon: '📐',
    description: '(Base × Altura / 2) × Longitud',
  },
  {
    id: GEOMETRY_TYPES.TRIANGLE_3_SIDES,
    label: 'Triángulo por 3 Lados (Isósceles / Herón / Escaleno)',
    shortLabel: 'Triáng. 3 Lados',
    icon: '🔺',
    description: '3 Lados a, b, c (Fórmula de Herón √[s(s-a)(s-b)(s-c)])',
  },
  {
    id: GEOMETRY_TYPES.TRAPEZOID,
    label: 'Trapecio / Canal / Talud Trapecial',
    shortLabel: 'Trapecio',
    icon: '⏢',
    description: '((Base Mayor + Base Menor) × Altura / 2) × Longitud',
  },
  {
    id: GEOMETRY_TYPES.TRUNCATED_PYRAMID,
    label: 'Zapata Troncocónica / Piramidal',
    shortLabel: 'Piramidal',
    icon: '🏛️',
    description: '(H / 3) × (A₁ + A₂ + √(A₁ × A₂))',
  },
  {
    id: GEOMETRY_TYPES.TRENCH,
    label: 'Zanja / Excavación (L × A × Prof.)',
    shortLabel: 'Zanja',
    icon: '⛏️',
    description: 'Longitud × Ancho × Profundidad (m³)',
  },
];

function round2(val) {
  if (val === null || val === undefined || isNaN(val) || val === '') return 0;
  return Math.round(Number(val) * 100) / 100;
}

function parseNum(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/\.{2,}/g, '.'));
  return isNaN(n) ? null : n;
}

/**
 * Calcula la base geométrica (1 unidad/vez) para una figura según sus parámetros y la unidad de la partida,
 * generando una cadena de fórmula que muestra TODOS los valores numéricos y constantes explícitos (3.1416, / 2, / 3, / 4).
 * 
 * @param {Object} row - Fila o parcial con campos geométricos
 * @param {string} unit - Unidad de medida (M3, M2, ML, etc.)
 * @returns {{ baseGeom: number, formulaStr: string, trenchDetails?: Object }}
 */
export function computeGeometryBase(row, unit = 'M3') {
  const geomType = row.geometryType || getDefaultGeometryType(unit);
  const normUnit = String(unit || '').trim().toUpperCase();

  switch (geomType) {
    case GEOMETRY_TYPES.CYLINDER: {
      // row.length actúa como Diámetro Ø (m), row.height como Altura H (m)
      const d = parseNum(row.diameter ?? row.length);
      const h = parseNum(row.height);

      if (d !== null && d > 0) {
        if (normUnit === 'M2') {
          // Área lateral del cilindro (encofrado o pintura): 3.1416 × D × H
          const heightVal = h !== null && h > 0 ? h : 1;
          const area = 3.1416 * d * heightVal;
          const roundedArea = round2(area);
          const formulaStr = h !== null && h > 0
            ? `(3.1416 × ${d}m × ${h}m) = ${roundedArea}m²`
            : `(3.1416 × ${d}m) = ${roundedArea}m²`;
          return { baseGeom: roundedArea, formulaStr };
        } else if (normUnit === 'M' || normUnit === 'ML') {
          // Perímetro circular: 3.1416 × D
          const perim = round2(3.1416 * d);
          return { baseGeom: perim, formulaStr: `(3.1416 × ${d}m) = ${perim}m` };
        } else {
          // Volumen del cilindro (M3): (3.1416 × D² / 4) × H
          const heightVal = h !== null && h > 0 ? h : 1;
          const vol = ((3.1416 * Math.pow(d, 2)) / 4) * heightVal;
          const roundedVol = round2(vol);
          const formulaStr = h !== null && h > 0
            ? `((3.1416 × (${d}m)² / 4) × ${h}m) = ${roundedVol}m³`
            : `(3.1416 × (${d}m)² / 4) = ${roundedVol}m³`;
          return { baseGeom: roundedVol, formulaStr };
        }
      }
      break;
    }

    case GEOMETRY_TYPES.TRIANGLE: {
      // row.length = Base (m), row.width = Altura del triángulo (m), row.height = Largo del tramo (m)
      const base = parseNum(row.triangleBase ?? row.length);
      const hTri = parseNum(row.triangleHeight ?? row.width);
      const length = parseNum(row.height);

      if (base !== null && base > 0 && hTri !== null && hTri > 0) {
        const areaTri = (base * hTri) / 2;
        const roundedArea = round2(areaTri);
        if (normUnit === 'M2') {
          return {
            baseGeom: roundedArea,
            formulaStr: `((${base}m × ${hTri}m) / 2) = ${roundedArea}m²`,
          };
        }
        // Volumen M3 = (Base × Altura / 2) × Largo
        const lenVal = length !== null && length > 0 ? length : 1;
        const vol = areaTri * lenVal;
        const roundedVol = round2(vol);
        const formulaStr = length !== null && length > 0
          ? `(((${base}m × ${hTri}m) / 2) × ${length}m) = ${roundedVol}m³`
          : `((${base}m × ${hTri}m) / 2) = ${roundedVol}m³`;
        return { baseGeom: roundedVol, formulaStr };
      }
      break;
    }

    case GEOMETRY_TYPES.TRIANGLE_3_SIDES: {
      // row.length = Lado A (m), row.width = Lado B (m), row.height = Lado C (m)
      const a = parseNum(row.sideA ?? row.length);
      const b = parseNum(row.sideB ?? row.width);
      let c = parseNum(row.sideC ?? row.height);

      // Si C está vacío pero A y B existen, y pueden formar un isósceles con 2 lados iguales a A (2a > b)
      if (c === null && a !== null && b !== null && a > 0 && b > 0 && (2 * a > b)) {
        c = a;
      }

      if (a !== null && a > 0 && b !== null && b > 0 && c !== null && c > 0) {
        // Desigualdad triangular: cada lado debe ser menor que la suma de los otros dos
        const isTriangle = (a + b > c) && (a + c > b) && (b + c > a);
        if (!isTriangle) {
          return {
            baseGeom: 0,
            formulaStr: `Lados (${a}m, ${b}m, ${c}m) no forman triángulo (desigualdad triangular)`,
          };
        }

        const s = (a + b + c) / 2;
        const radicand = s * (s - a) * (s - b) * (s - c);
        const areaTri = Math.sqrt(Math.max(0, radicand));
        const roundedArea = round2(areaTri);

        if (normUnit === 'M' || normUnit === 'ML') {
          const perim = round2(a + b + c);
          return {
            baseGeom: perim,
            formulaStr: `(${a}m + ${b}m + ${c}m) = ${perim}m`,
          };
        }

        if (normUnit === 'M2') {
          const formulaStr = `√[${round2(s)} × ${round2(s - a)} × ${round2(s - b)} × ${round2(s - c)}] = ${roundedArea}m²`;
          return {
            baseGeom: roundedArea,
            formulaStr,
          };
        }

        // Volumen M3: Área × Espesor / Longitud H (en distance)
        const thick = parseNum(row.distance ?? row.thickness);
        const hasThick = thick !== null && thick > 0;
        const lenVal = hasThick ? thick : 1;
        const vol = areaTri * lenVal;
        const roundedVol = round2(vol);
        const formulaStr = hasThick
          ? `[√[${round2(s)} × ${round2(s - a)} × ${round2(s - b)} × ${round2(s - c)}] × ${lenVal}m] = ${roundedVol}m³`
          : `√[${round2(s)} × ${round2(s - a)} × ${round2(s - b)} × ${round2(s - c)}] = ${roundedVol}m³`;

        return { baseGeom: roundedVol, formulaStr };
      }
      break;
    }

    case GEOMETRY_TYPES.TRAPEZOID: {
      // Trapecio: Base Mayor B, Base Menor b, Altura h, y Longitud L (para M3)
      // Si baseMinor está explícito en la fila:
      let bMaj = parseNum(row.baseMajor);
      let bMin = parseNum(row.baseMinor);
      let h = parseNum(row.height);
      let len = parseNum(row.trapezoidLength ?? row.length);

      // Si no hay baseMajor separado:
      // Si normUnit es M2: length = Base Mayor, width = Base Menor, height = Altura
      // Si normUnit es M3: length = Longitud L, width = Base Mayor, baseMinor = Base Menor (o width = bMaj, baseMinor = bMin)
      if (bMaj === null) {
        if (normUnit === 'M2' || len === null || len <= 0) {
          bMaj = parseNum(row.length);
          bMin = parseNum(row.width ?? row.baseMinor);
          h = parseNum(row.height);
          len = 1;
        } else {
          // En M3, si width tiene la Base Mayor y baseMinor la Menor
          if (row.baseMinor !== undefined && row.baseMinor !== null && row.baseMinor !== '') {
            bMaj = parseNum(row.width);
            bMin = parseNum(row.baseMinor);
            len = parseNum(row.length);
          } else {
            bMaj = parseNum(row.length);
            bMin = parseNum(row.width);
            len = parseNum(row.distance ?? row.trapezoidLength ?? 1);
          }
        }
      }

      if (bMaj !== null && bMaj > 0 && bMin !== null && bMin > 0 && h !== null && h > 0) {
        const areaTrap = ((bMaj + bMin) * h) / 2;
        const roundedArea = round2(areaTrap);
        if (normUnit === 'M2') {
          const formulaStr = `(((${bMaj}m + ${bMin}m) × ${h}m) / 2) = ${roundedArea}m²`;
          return { baseGeom: roundedArea, formulaStr };
        }
        const lenVal = len !== null && len > 0 ? len : 1;
        const vol = areaTrap * lenVal;
        const roundedVol = round2(vol);
        const formulaStr = lenVal > 1
          ? `[(((${bMaj}m + ${bMin}m) × ${h}m) / 2) × ${lenVal}m] = ${roundedVol}m³`
          : `(((${bMaj}m + ${bMin}m) × ${h}m) / 2) = ${roundedVol}m³`;
        return { baseGeom: roundedVol, formulaStr };
      }
      break;
    }

    case GEOMETRY_TYPES.TRUNCATED_PYRAMID: {
      // row.length = Lado base mayor L1 (m), row.width = Lado base menor L2 (m), row.height = Altura H (m)
      const l1 = parseNum(row.baseMajor ?? row.length);
      const l2 = parseNum(row.baseMinor ?? row.width);
      const h = parseNum(row.height);

      if (l1 !== null && l1 > 0 && h !== null && h > 0) {
        const a1 = Math.pow(l1, 2);
        const a2 = l2 !== null && l2 > 0 ? Math.pow(l2, 2) : 0;
        // Fórmula de zapata piramidal / tronco de pirámide: H/3 * (A1 + A2 + sqrt(A1 * A2))
        const vol = (h / 3) * (a1 + a2 + Math.sqrt(a1 * a2));
        const roundedVol = round2(vol);
        const formulaStr = `(${h}m / 3) × [(${l1}m)² + (${l2 || 0}m)² + √(${round2(a1)} × ${round2(a2)})] = ${roundedVol}m³`;
        return { baseGeom: roundedVol, formulaStr };
      }
      break;
    }

    case GEOMETRY_TYPES.TRENCH: {
      // row.length = Longitud L (m), row.width = Ancho A (m), row.height = Profundidad H (m)
      const l = parseNum(row.length);
      const w = parseNum(row.width);
      const h = parseNum(row.height);

      if (l !== null && l > 0 && w !== null && w > 0 && h !== null && h > 0) {
        const vExc = round2(l * w * h);
        const formulaStr = `${l}m × ${w}m × ${h}m = ${vExc}m³`;
        return { baseGeom: vExc, formulaStr };
      }
      break;
    }

    case GEOMETRY_TYPES.RECTANGLE:
    case GEOMETRY_TYPES.PRISM:
    default:
      break;
  }

  return { baseGeom: null, formulaStr: '' };
}
