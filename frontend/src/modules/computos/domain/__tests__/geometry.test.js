import { describe, it, expect } from 'vitest';
import { computeGeometryBase, GEOMETRY_TYPES } from '../geometry.js';
import { recomputeRow } from '../formulas.js';
import { rowsReducer } from '../../state/rowsReducer.js';

describe('Intelligent Geometry Templates', () => {
  it('computes cylinder volume for M3 (V = π·D²/4 · H)', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.CYLINDER,
      length: 0.40, // Diámetro Ø = 0.40m
      height: 3.00, // Altura H = 3.00m
      unit: 'M3',
    };
    const res = computeGeometryBase(row, 'M3');
    // 3.1416 * (0.40)^2 / 4 * 3.00 = 0.37699... -> 0.38 m3
    expect(res.baseGeom).toBe(0.38);
    expect(res.formulaStr).toContain('3.1416');
    expect(res.formulaStr).toContain('/ 4');
  });

  it('computes cylinder lateral area for M2 (A = π·D·H)', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.CYLINDER,
      length: 0.50, // Diámetro Ø = 0.50m
      height: 2.00, // Altura H = 2.00m
      unit: 'M2',
    };
    const res = computeGeometryBase(row, 'M2');
    // π * 0.50 * 2.00 = 3.14159... -> 3.14 m2
    expect(res.baseGeom).toBe(3.14);
  });

  it('computes 3-side triangle area with Heron\'s formula (user sides 1.67, 1.20, 1.02)', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRIANGLE_3_SIDES,
      length: 1.67, // Lado a
      width: 1.20,  // Lado b
      height: 1.02, // Lado c
      unit: 'M2',
    };
    const res = computeGeometryBase(row, 'M2');
    // s = (1.67 + 1.20 + 1.02)/2 = 1.945
    // area = sqrt(1.945 * 0.275 * 0.745 * 0.925) = sqrt(0.368536...) = 0.60707... -> 0.61 m2
    expect(res.baseGeom).toBe(0.61);
    expect(res.formulaStr).toContain('0.61m²');
    expect(res.formulaStr).toContain('√[');
  });

  it('computes isosceles triangle when side C is empty (c defaults to a)', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRIANGLE_3_SIDES,
      length: 1.67, // Lado a
      width: 1.20,  // Base b
      height: '',   // Lado c omitido (isósceles a, b, a)
      unit: 'M2',
    };
    const res = computeGeometryBase(row, 'M2');
    // a = 1.67, b = 1.20, c = 1.67
    // s = (1.67 + 1.20 + 1.67)/2 = 2.27
    // area = (1.20 / 4) * sqrt(4 * 1.67^2 - 1.20^2) = 0.3 * sqrt(11.1556 - 1.44) = 0.3 * 3.117 = 0.935 -> 0.94 m2
    expect(res.baseGeom).toBe(0.94);
  });

  it('computes 3-side triangle prism volume for M3 with thickness', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRIANGLE_3_SIDES,
      length: 1.67,
      width: 1.20,
      height: 1.02,
      distance: 0.10, // Espesor 10cm = 0.10m
      unit: 'M3',
    };
    const res = computeGeometryBase(row, 'M3');
    // 0.60707 * 0.10 = 0.0607 -> 0.06 m3
    expect(res.baseGeom).toBe(0.06);
    expect(res.formulaStr).toContain('0.1m');
    expect(res.formulaStr).toContain('0.06m³');
  });

  it('detects triangle inequality violation and returns 0 with error description', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRIANGLE_3_SIDES,
      length: 1.67,
      width: 1.20,
      height: 5.00, // 1.67 + 1.20 = 2.87 < 5.00 (imposible cerrar triángulo)
      unit: 'M2',
    };
    const res = computeGeometryBase(row, 'M2');
    expect(res.baseGeom).toBe(0);
    expect(res.formulaStr).toContain('no forman triángulo');
  });

  it('computes triangular section volume (V = Base × Altura / 2 × Largo)', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRIANGLE,
      length: 2.00, // Base
      width: 1.50,  // Altura triángulo
      height: 10.00, // Largo tramo
      unit: 'M3',
    };
    const res = computeGeometryBase(row, 'M3');
    // (2.00 * 1.50 / 2) * 10 = 15.00 m3
    expect(res.baseGeom).toBe(15);
    expect(res.formulaStr).toContain('/ 2');
  });

  it('computes trapezoid section area for M2 (A = (B + b)·h / 2)', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRAPEZOID,
      length: 2.50, // Base Mayor B = 2.50m
      width: 1.50,  // Base Menor b = 1.50m
      height: 1.20, // Altura h = 1.20m
      unit: 'M2',
    };
    const res = computeGeometryBase(row, 'M2');
    // ((2.50 + 1.50) * 1.20) / 2 = (4.00 * 1.20) / 2 = 2.40 m2
    expect(res.baseGeom).toBe(2.40);
    expect(res.formulaStr).toContain('/ 2');
    expect(res.formulaStr).toBe('(((2.5m + 1.5m) × 1.2m) / 2) = 2.4m²');
  });

  it('computes trapezoid canal/trench volume for M3 (V = ((B + b)·h / 2) · L)', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRAPEZOID,
      length: 2.00, // Base Mayor B = 2.00m
      width: 1.00,  // Base Menor b = 1.00m
      height: 0.80, // Altura h = 0.80m
      distance: 10.00, // Longitud L = 10.00m
      unit: 'M3',
    };
    const res = computeGeometryBase(row, 'M3');
    // ((2.00 + 1.00) * 0.80 / 2) * 10 = (3.00 * 0.40) * 10 = 12.00 m3
    expect(res.baseGeom).toBe(12.00);
    expect(res.formulaStr).toContain('/ 2');
    expect(res.formulaStr).toContain('10m');
    expect(res.formulaStr).toBe('[(((2m + 1m) × 0.8m) / 2) × 10m] = 12m³');
  });

  it('computes truncated pyramid footing volume: H/3 · (A1 + A2 + √(A1·A2))', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRUNCATED_PYRAMID,
      length: 2.00, // Lado base mayor L1 -> A1 = 4.00
      width: 1.00,  // Lado base menor L2 -> A2 = 1.00
      height: 0.60, // Altura H = 0.60m
      unit: 'M3',
    };
    const res = computeGeometryBase(row, 'M3');
    // 0.60 / 3 * (4 + 1 + sqrt(4)) = 0.20 * (5 + 2) = 1.40 m3
    expect(res.baseGeom).toBe(1.40);
  });

  it('computes trench excavation volume (V = Longitud × Ancho × Profundidad)', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRENCH,
      length: 20.00, // Longitud 20m
      width: 0.80,   // Ancho 0.80m
      height: 1.50,  // Profundidad 1.50m
      unit: 'M3',
    };
    const res = computeGeometryBase(row, 'M3');
    // Excavación = 20 * 0.80 * 1.50 = 24.00 m3
    expect(res.baseGeom).toBe(24);
    expect(res.formulaStr).toBe('20m × 0.8m × 1.5m = 24m³');
    expect(res.formulaStr).not.toContain('Cama');
  });

  it('integrates seamlessly with recomputeRow and times multiplier', () => {
    const initialRow = {
      id: 'row-cyl-1',
      unit: 'M3',
      geometryType: GEOMETRY_TYPES.CYLINDER,
      length: 0.60, // Ø 60cm
      height: 4.00, // H 4m
      times: 4,     // 4 pilotes iguales
      factor: '',
      distance: '',
    };
    const updated = recomputeRow(initialRow, 'times', 4);
    // V unitario = π * (0.60)^2 / 4 * 4.00 = 1.13097 -> 1.13 m3
    // Total 4 veces = 1.13 * 4 = 4.52 m3
    expect(updated.partial).toBe(1.13);
    expect(updated.quantity).toBe(4.52);
    expect(updated.m3).toBe(4.52);
  });
});

describe('Steel Rebar Diameter Selection & Factor Synchronization', () => {
  it('automatically sets nominal weight factor when selecting 1/2" diameter', () => {
    const initialRow = {
      id: 'steel-1',
      unit: 'KG',
      description: 'ACERO DE REFUERZO CABILLAS FY 4200',
      length: 6.00, // 6 metros por barra
      height: 4,    // 4 barras
      times: 2,     // 2 vigas
      factor: '',
      rebarDiameter: '',
    };

    // Selecting 1/2" (N° 4)
    const updated = recomputeRow(initialRow, 'rebarDiameter', '1/2"');
    // Spec weight is 0.994 kg/m
    expect(updated.factor).toBe(0.994);
    // 6m * 4 barras = 24 ml * 0.994 kg/m = 23.86 kg parcial
    expect(updated.partial).toBe(23.86);
    // 2 vigas = 23.86 * 2 = 47.72 kg
    expect(updated.quantity).toBe(47.72);
  });

  it('updates factor atomically via rowsReducer for both items and partials', () => {
    const state = {
      rows: [
        {
          id: 'steel-row-1',
          unit: 'KG',
          description: 'CABILLAS DE ACERO',
          length: 5.00,
          height: 2,
          times: 1,
          factor: '',
          rebarDiameter: '',
        },
      ],
      activeChapter: '',
    };

    // Update main item diameter to 3/8"
    const nextState = rowsReducer(state, {
      type: 'UPDATE_FIELD',
      payload: { itemId: 'steel-row-1', field: 'rebarDiameter', value: '3/8"' },
    });

    const target = nextState.rows.find((r) => r.id === 'steel-row-1');
    expect(target.factor).toBe(0.559);
    // 5m * 2 barras = 10 ml * 0.559 = 5.59 kg
    expect(target.quantity).toBe(5.59);
  });
});
