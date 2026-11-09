import { describe, it, expect } from 'vitest';
import {
  round2,
  evaluateMeasurementFormula,
  computePartial,
  recomputeItemWithPartials,
  recomputeRow,
  cleanFormulaDisplay,
} from '../formulas.js';

describe('fórmulas de cómputos', () => {
  it('evalúa largo por ancho como área', () => {
    const result = evaluateMeasurementFormula('2 x 3');
    expect(result).not.toBeNull();
    expect(result.quantity).toBe(6);
    expect(result.length).toBe(2);
    expect(result.width).toBe(3);
    expect(result.inferredUnit).toBe('M2');
  });

  it('evalúa tres dimensiones como volumen', () => {
    const result = evaluateMeasurementFormula('2 x 3 x 4');
    expect(result.quantity).toBe(24);
    expect(result.height).toBe(4);
    expect(result.inferredUnit).toBe('M3');
  });

  it('respeta la unidad explícita', () => {
    const result = evaluateMeasurementFormula('2 x 3 m2');
    expect(result.explicitUnit).toBe('M2');
    expect(result.inferredUnit).toBe('M2');
  });

  it('rechaza texto que no es una medición', () => {
    expect(evaluateMeasurementFormula('demolición de pared')).toBeNull();
    expect(evaluateMeasurementFormula('')).toBeNull();
    expect(evaluateMeasurementFormula('0 x 4')).toBeNull();
  });

  it('calcula parciales con dimensiones y veces', () => {
    expect(computePartial({ length: 2, width: 3, times: 2 })).toBe(12);
  });

  it('calcula parciales con factor y distancia', () => {
    expect(computePartial({ length: 2, width: 3, factor: 2, distance: 3 })).toBe(36);
  });

  it('calcula parciales con M3 y distancia (transporte)', () => {
    expect(computePartial({ m3: 30.4, distance: 4.8 })).toBe(145.92);
  });

  it('suma parciales de una partida', () => {
    const result = recomputeItemWithPartials({
      quantity: 0,
      m3: '',
      partials: [
        { length: 2, width: 3, times: 1 },
        { length: 1, width: 4, times: 1 },
      ],
    });
    expect(result.quantity).toBe(10);
  });

  it('recalcula una fila al cambiar dimensiones', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '', distance: '', partial: 0, quantity: 0, unit: 'M2', formula: '' };
    const withLength = recomputeRow(base, 'length', '2');
    const withWidth = recomputeRow(withLength, 'width', '3');
    expect(withWidth.partial).toBe(6);
    expect(withWidth.quantity).toBe(6);
  });

  it('recalcula una fila al cambiar cantidad manual', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '', distance: '', partial: 0, quantity: 0, unit: 'M2', formula: '' };
    const result = recomputeRow(base, 'quantity', '12');
    expect(result.quantity).toBe(12);
    expect(result.partial).toBe(12);
  });

  it('calcula transporte multiplicando volumen M3 por distancia', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '1.000', distance: '', m3: '', partial: 0, quantity: 0, unit: 'M3-KM', formula: '' };
    const withM3 = recomputeRow(base, 'm3', '30.4');
    expect(withM3.partial).toBe(30.4);
    expect(withM3.quantity).toBe(30.4);

    const withDist = recomputeRow(withM3, 'distance', '4.8');
    expect(withDist.partial).toBe(145.92);
    expect(withDist.quantity).toBe(145.92);

    const withTimes = recomputeRow(withDist, 'times', '2');
    expect(withTimes.partial).toBe(145.92);
    expect(withTimes.quantity).toBe(291.84);
  });

  it('redondea a dos decimales con round2', () => {
    expect(round2(20.304)).toBe(20.3);
    expect(round2(0.2358)).toBe(0.24);
    expect(round2(3.242)).toBe(3.24);
    expect(round2(145.92)).toBe(145.92);
    expect(round2(null)).toBe(0);
  });

  it('redondea cálculos de mediciones y filas a exactamente dos decimales', () => {
    const evalRes = evaluateMeasurementFormula('11.28 x 1.80');
    expect(evalRes.quantity).toBe(20.3);

    const partialVal = computePartial({ length: 11.28, width: 0.12, height: 2.1 });
    expect(partialVal).toBe(2.84);

    const base = { length: '', width: '', height: '', times: 1, factor: '', distance: '', partial: 0, quantity: 0, unit: 'M3', formula: '' };
    const rowCalc = recomputeRow(recomputeRow(recomputeRow(base, 'length', '6.55'), 'width', '0.12'), 'height', '0.3');
    expect(rowCalc.partial).toBe(0.24);
    expect(rowCalc.quantity).toBe(0.24);
    expect(rowCalc.m3).toBe(0.24);
  });

  it('limpia desgloses antiguos de zanjas en cleanFormulaDisplay', () => {
    const rawFormula = '4m × 1m × 0.5m = 2m³ [Exc: 2m³ | Cama: 0m³ | Relleno: 2m³]';
    expect(cleanFormulaDisplay(rawFormula)).toBe('4m × 1m × 0.5m = 2m³');

    const cleanFormula = '4m × 1m × 0.5m = 2m³';
    expect(cleanFormulaDisplay(cleanFormula)).toBe('4m × 1m × 0.5m = 2m³');

    expect(cleanFormulaDisplay('')).toBe('');
    expect(cleanFormulaDisplay(null)).toBe('');
  });

  it('permite veces negativo para deducciones de vanos/puertas/ventanas', () => {
    const pDeduccion = { length: 0.8, width: 1.9, times: -1, unit: 'M2' };
    const parcial = computePartial(pDeduccion);
    expect(parcial).toBe(-1.52);
    expect(pDeduccion.formula).toContain('-1 ×');

    const item = recomputeItemWithPartials({
      unit: 'M2',
      partials: [
        { length: 3.4, width: 2.0, times: 1 },
        { length: 0.8, width: 1.9, times: -1 },
      ],
    });
    expect(item.quantity).toBe(5.28);
  });

  it('calcula correctamente unidades discretas como PTO en parciales sin dimensiones y no se multiplica recursivamente', () => {
    const p1 = { description: 'wc piso2', length: '', width: '', height: '', times: 5, factor: '1.000', unit: 'PTO' };
    const res1 = computePartial(p1, 'PTO');
    expect(res1).toBe(5);
    expect(p1.partial).toBe(5);

    // Llamadas repetidas (re-renders) no deben multiplicar exponencialmente (evita bug 15.625)
    computePartial(p1, 'PTO');
    expect(p1.partial).toBe(5);
    computePartial(p1, 'PTO');
    expect(p1.partial).toBe(5);

    const p2 = { description: 'Parcial 2', length: '', width: '', height: '', times: 5, factor: '1.000', unit: 'PTO' };
    const p3 = { description: 'Parcial 3', length: '', width: '', height: '', times: 2, factor: '1.000', unit: 'PTO' };
    const p4 = { description: 'Parcial 4', length: '', width: '', height: '', times: 2, factor: '1.000', unit: 'PTO' };
    const p5 = { description: 'banos', length: '', width: '', height: '', times: 4, factor: '1.000', unit: 'PTO' };

    const itemPto = recomputeItemWithPartials({
      unit: 'PTO',
      partials: [p1, p2, p3, p4, p5],
    });
    // 5 + 5 + 2 + 2 + 4 = 18 PTO
    expect(itemPto.quantity).toBe(18);
    expect(p1.partial).toBe(5);
    expect(p2.partial).toBe(5);
    expect(p3.partial).toBe(2);
    expect(p4.partial).toBe(2);
    expect(p5.partial).toBe(4);
  });

  it('recalcula fila de unidad discreta al cambiar veces sin dimensiones', () => {
    const base = { length: '', width: '', height: '', times: 1, factor: '', distance: '', partial: 0, quantity: 0, unit: 'PTO', formula: '' };
    const result = recomputeRow(base, 'times', '5');
    expect(result.quantity).toBe(5);
    expect(result.partial).toBe(1);
    expect(result.formula).toContain('5 × 1 = 5 PTO');
  });
});
