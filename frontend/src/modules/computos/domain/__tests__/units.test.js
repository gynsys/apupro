import { describe, it, expect } from 'vitest';
import {
  COMMON_UNITS,
  normalizeUnitStr,
  inferUnitFromDescription,
} from '../units.js';

describe('unidades de cómputos', () => {
  it('normaliza alias de área y volumen', () => {
    expect(normalizeUnitStr('m2')).toBe('M2');
    expect(normalizeUnitStr('m²')).toBe('M2');
    expect(normalizeUnitStr('m3')).toBe('M3');
    expect(normalizeUnitStr('m³')).toBe('M3');
    expect(normalizeUnitStr('ml')).toBe('ML');
  });

  it('normaliza acarreo y transporte', () => {
    expect(normalizeUnitStr('m3-km')).toBe('M3-KM');
    expect(normalizeUnitStr('m3 x km')).toBe('M3-KM');
    expect(normalizeUnitStr('ton-km')).toBe('TON-KM');
    expect(normalizeUnitStr('viaje')).toBe('VIAJE');
  });

  it('devuelve la unidad en mayúsculas si no es alias', () => {
    expect(normalizeUnitStr(' global ')).toBe('GL');
    expect(normalizeUnitStr('UNIDAD-NUEVA')).toBe('UNIDAD-NUEVA');
    expect(normalizeUnitStr('')).toBeNull();
  });

  it('infiere unidad desde la descripción', () => {
    expect(inferUnitFromDescription('Pintura de pared')).toBe('M2');
    expect(inferUnitFromDescription('Excavación de zanja')).toBe('M3');
    expect(inferUnitFromDescription('Tubería de agua')).toBe('ML');
    expect(inferUnitFromDescription('Toma corriente')).toBe('PTO');
    expect(inferUnitFromDescription('Cabilla de refuerzo')).toBe('KGF');
    expect(inferUnitFromDescription('Transporte de escombro a 5 km')).toBe('M3-KM');
  });

  it('mantiene el catálogo base de unidades', () => {
    expect(COMMON_UNITS).toContain('M2');
    expect(COMMON_UNITS).toContain('M3');
    expect(COMMON_UNITS).toContain('UND');
    expect(COMMON_UNITS).toContain('M3-KM');
  });
});
