import { describe, it, expect } from 'vitest';
import {
  round2,
  evaluateMeasurementFormula,
  computePartial,
  recomputeItemWithPartials,
  recomputeRow,
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
});