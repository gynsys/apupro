import { describe, it, expect } from 'vitest';
import {
  REBAR_DIAMETERS,
  isSteelRow,
  getRebarSpec,
  calculateStirrupCutLength,
} from '../steel.js';

describe('módulo de acero de refuerzo (steel)', () => {
  it('contiene la tabla oficial de diámetros COVENIN', () => {
    expect(REBAR_DIAMETERS).toHaveLength(9);
    const rebar12 = REBAR_DIAMETERS.find((r) => r.inches === '1/2"');
    expect(rebar12).toBeDefined();
    expect(rebar12.weightKgM).toBe(0.994);

    const rebar38 = REBAR_DIAMETERS.find((r) => r.inches === '3/8"');
    expect(rebar38.weightKgM).toBe(0.559);

    const rebar58 = REBAR_DIAMETERS.find((r) => r.inches === '5/8"');
    expect(rebar58.weightKgM).toBe(1.552);
  });

  it('detecta si una fila es de acero por unidad o por descripción', () => {
    expect(isSteelRow({ unit: 'KGF' })).toBe(true);
    expect(isSteelRow({ unit: 'KG' })).toBe(true);
    expect(isSteelRow({ unit: 'TON' })).toBe(true);
    expect(isSteelRow({ unit: 'M2', description: 'SUMINISTRO DE CABILLAS FY=4200' })).toBe(true);
    expect(isSteelRow({ unit: 'M3', description: 'CONCRETO PREMEZCLADO' })).toBe(false);
    expect(isSteelRow(null)).toBe(false);
  });

  it('obtiene la especificación de una cabilla por diámetro', () => {
    const spec = getRebarSpec('1/2"');
    expect(spec).not.toBeNull();
    expect(spec.weightKgM).toBe(0.994);
    expect(spec.designation).toBe('N° 4');

    expect(getRebarSpec('desconocido')).toBeNull();
  });

  it('calcula la longitud de corte de un estribo rectangular', () => {
    // Viga 30x40 cm con recubrimiento 2.5 cm y ganchos de 10 cm:
    // Core base = 30 - 5 = 25 cm
    // Core altura = 40 - 5 = 35 cm
    // Perímetro = 2*(25 + 35) = 120 cm
    // Ganchos = 2 * 10 = 20 cm
    // Total = 140 cm = 1.40 m
    const lengthM = calculateStirrupCutLength(30, 40, 2.5, 10);
    expect(lengthM).toBe(1.4);
  });
});
