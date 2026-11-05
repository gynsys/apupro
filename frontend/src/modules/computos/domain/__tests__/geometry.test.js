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
    // π * (0.40)^2 / 4 * 3.00 = 0.37699... -> 0.38 m3
    expect(res.baseGeom).toBe(0.38);
    expect(res.formulaStr).toContain('π');
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

  it('computes trench and pipeline excavation, bedding and backfill', () => {
    const row = {
      geometryType: GEOMETRY_TYPES.TRENCH,
      length: 20.00, // Longitud 20m
      width: 0.80,   // Ancho 0.80m
      height: 1.50,  // Profundidad 1.50m
      trenchBeddingHeight: 0.10, // Cama de arena 10cm
      trenchPipeDiameter: 0.30,  // Tubo Ø 30cm
      description: 'EXCAVACIÓN EN ZANJA PARA TUBERÍA',
      unit: 'M3',
    };
    const res = computeGeometryBase(row, 'M3');
    // Excavación = 20 * 0.80 * 1.50 = 24.00 m3
    expect(res.baseGeom).toBe(24);
    expect(res.trenchDetails.excavationM3).toBe(24);
    // Cama de arena = 20 * 0.80 * 0.10 = 1.60 m3
    expect(res.trenchDetails.beddingM3).toBe(1.60);
    // Relleno = Excavación - Cama - Tubo
    expect(res.trenchDetails.backfillM3).toBeLessThan(24);
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
