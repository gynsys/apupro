/**
 * Tests de caracterización de actionPipelines.js
 * ----------------------------------------------
 * Esta batería congela el comportamiento ACTUAL (antes de refactorizar) para
 * garantizar que tras la modularización NO cambie nada.
 *
 * Las pruebas son 100% headless: importan funciones puras y no requieren
 * levantar el servidor, el DOM, el backend ni la base de datos.
 */
import { describe, it, expect } from 'vitest';
import * as api from '../actionPipelines.js';

// ============================================================================
// PRUEBA 1 — Fingerprint / snapshot de todo el catálogo
// Serializa data + funciones (chips/format) para comparar de forma estable.
// Si el refactor es mecánico, este snapshot NO debe cambiar jamás.
// ============================================================================
describe('PRUEBA 1 — Fingerprint de ACTION_FLOW_PIPELINES', () => {
  // Nota: se normalizan los prefijos __vite_ssr_import_N__ que Vitest inyecta al
  // importar helpers desde otros módulos; el snapshot solo capta cambios semánticos.
  const fingerprint = (pipelines) =>
    JSON.parse(
      JSON.stringify(pipelines, (key, value) => {
        if (typeof value === 'function') {
          return `[FN:${value.toString().replace(/__vite_ssr_import_\d+__\./g, '')}]`;
        }
        return value;
      })
    );

  it('snapshot dorado: el catálogo completo no cambia', () => {
    expect(fingerprint(api.ACTION_FLOW_PIPELINES)).toMatchSnapshot();
  });
});

// ============================================================================
// PRUEBA 2 — Invariancias estructurales
// ============================================================================
describe('PRUEBA 2 — Invariancias estructurales', () => {
  it('existen los 23 chips atómicos', () => {
    expect(api.ACCIONES_STEP1_CHIPS).toHaveLength(23);
    // Sin duplicados
    expect(new Set(api.ACCIONES_STEP1_CHIPS).size).toBe(23);
  });

  it('cada acción tiene al menos 2 pasos con id único', () => {
    for (const [action, steps] of Object.entries(api.ACTION_FLOW_PIPELINES)) {
      expect(Array.isArray(steps), `${action} debe ser un array`).toBe(true);
      expect(steps.length, `${action} debe tener pasos`).toBeGreaterThanOrEqual(2);

      const ids = steps.map((s) => s.id);
      expect(new Set(ids).size, `${action} debe tener id únicos`).toBe(ids.length);

      for (const step of steps) {
        expect(typeof step.text, `${action}.${step.id} text`).toBe('string');
        expect(typeof step.chips, `${action}.${step.id} chips`).toBe('function');
      }
    }
  });

  it('el catálogo tiene exactamente 25 claves (21 acciones + 4 alias)', () => {
    expect(Object.keys(api.ACTION_FLOW_PIPELINES)).toHaveLength(25);
  });

  it('los 4 alias históricos están presentes y apuntan bien (guardia anti-pérdida)', () => {
    const P = api.ACTION_FLOW_PIPELINES;
    expect(P['mantenimiento']).toBe(P['reparacion']);
    expect(P['suministro e instalacion']).toBe(P['instalacion']);
    expect(P['suministro e instalación']).toBe(P['instalacion']);
    expect(P['vaciado de concreto']).toBe(P['vaciado']);
  });

  it('los pasos "isUnit" son consistentes (texto de unidad + formato)', () => {
    for (const [action, steps] of Object.entries(api.ACTION_FLOW_PIPELINES)) {
      for (const step of steps.filter((s) => s.isUnit)) {
        expect(typeof step.format, `${action}.${step.id} formato de unidad`)
          .toBe('function');
      }
    }
  });
});

// ============================================================================
// PRUEBA 3 — getActionPipeline: lookup exacto, alias, regex y normalización
// ============================================================================
describe('PRUEBA 3 — getActionPipeline', () => {
  // [entrada, clave esperada | null → DEFAULT]
  const casos = [
    ['compactación', 'compactacion'],
    ['excavación', 'excavacion'],
    ['demolición', 'demolicion'],
    ['remoción', 'remocion'],
    ['limpieza', 'limpieza'],
    ['transporte', 'transporte'],
    ['acarreo', 'acarreo'],
    ['deforestación', 'deforestacion'],
    ['relleno', 'relleno'],
    ['construcción', 'construccion'],
    ['vaciado', 'vaciado'],
    ['vaciado de concreto', 'vaciado'], // alias
    ['concreto', 'vaciado'],            // regex /vaciado|concreto/
    ['instalación', 'instalacion'],
    ['suministro e instalación', 'instalacion'], // alias
    ['pintura', 'pintura'],
    ['impermeabilización', 'impermeabilizacion'],
    ['colocación', 'colocacion'],
    ['desmontaje', 'desmontaje'],
    ['reparación', 'reparacion'],
    ['mantenimiento', 'reparacion'],    // regex /reparac|manten/
    ['restauración', 'restauracion'],
    ['saneamiento', 'saneamiento'],
    ['confección', 'confeccion'],
    ['tratamiento', 'tratamiento'],
    // Normalizaciones
    ['  PINTURA ', 'pintura'],          // trim + mayúsculas
    ['COMPACTACIÓN', 'compactacion'],   // mayúsculas + tilde
    // Casos que deben caer en DEFAULT
    ['algo totalmente desconocido', null],
    ['', null],
    [undefined, null],
    [12345, null],
    [null, null],
  ];

  it.each(casos)('resuelve %j → %s', (input, expectedKey) => {
    const result = api.getActionPipeline(input);
    if (expectedKey === null) {
      expect(result).toBe(api.DEFAULT_PIPELINE);
    } else {
      expect(result).toBe(api.ACTION_FLOW_PIPELINES[expectedKey]);
    }
  });
});

// ============================================================================
// PRUEBA 4 — buildPipelinePrompt: contrato de texto exacto
// ============================================================================
describe('PRUEBA 4 — buildPipelinePrompt', () => {
  it('prompt completo con respuestas reales (compactación)', () => {
    const answers = {
      metodo: 'Manual con pisón',
      elemento: 'Fondo de zanja para tuberías',
      control: 'Omitir',
    };
    const { finalPrompt } = api.buildPipelinePrompt(
      'Compactación',
      answers,
      api.ACTION_FLOW_PIPELINES.compactacion
    );
    expect(finalPrompt).toMatch(/^Compactación /);
    expect(finalPrompt).toMatch(/manual con pisón/);
    expect(finalPrompt).toMatch(/en fondo de zanja para tuberías/);
    // La respuesta omitida no debe aparecer
    expect(finalPrompt).not.toMatch(/Omitir/i);
  });

  it('extrae unidad m2 desde m²', () => {
    const pipe = [{ id: 'unidad', isUnit: true }];
    const r = api.buildPipelinePrompt('Pintura', { unidad: 'm²' }, pipe);
    expect(r.unit).toBe('m2');
    expect(r.isGlobal).toBe(false);
    expect(r.finalPrompt).toBe('Pintura unidad m2');
  });

  it('detecta unidad global Gl', () => {
    const pipe = [{ id: 'unidad', isUnit: true }];
    expect(api.buildPipelinePrompt('X', { unidad: 'Gl' }, pipe))
      .toMatchObject({ unit: 'Gl', isGlobal: true });
    expect(api.buildPipelinePrompt('X', { unidad: 'suma global' }, pipe))
      .toMatchObject({ unit: 'Gl', isGlobal: true });
  });

  it('sin answers devuelve solo la acción', () => {
    const r = api.buildPipelinePrompt('Demolición', {}, api.ACTION_FLOW_PIPELINES.demolicion);
    expect(r.finalPrompt).toBe('Demolición');
    expect(r.unit).toBeNull();
    expect(r.isGlobal).toBe(false);
  });
});

// ============================================================================
// PRUEBA 5 — isOmitted y extractCleanUnit (edge cases)
// ============================================================================
describe('PRUEBA 5 — isOmitted / extractCleanUnit', () => {
  it('isOmitted detecta todos los valores de omisión', () => {
    for (const v of ['Omitir', 'NINGUNO', 'ninguno / omitir', 'Sugerir por ia', 'sugerir', null, '  omitir  ']) {
      expect(api.isOmitted(v), JSON.stringify(v)).toBe(true);
    }
    expect(api.isOmitted('bloque de arcilla')).toBe(false);
  });

  it('extractCleanUnit normaliza unidades', () => {
    expect(api.extractCleanUnit('m²')).toBe('m2');
    expect(api.extractCleanUnit('m³')).toBe('m3');
    expect(api.extractCleanUnit('M2')).toBe('m2');
    expect(api.extractCleanUnit('ml (metro lineal)')).toBe('ml');
    expect(api.extractCleanUnit('Omitir')).toBeNull();
    expect(api.extractCleanUnit(null)).toBeNull();
  });
});

// ============================================================================
// PRUEBA 6 — Compatibilidad de la API pública del módulo
// El barrel debe exponer exactamente estos nombres, ni más ni menos.
// ============================================================================
describe('PRUEBA 6 — API pública del módulo', () => {
  const EXPECTED = [
    'ACCIONES_STEP1_CHIPS',
    'ACTION_FLOW_PIPELINES',
    'DEFAULT_PIPELINE',
    'getActionPipeline',
    'buildPipelinePrompt',
    'extractCleanUnit',
    'isOmitted',
  ];

  it('expone exactamente la API esperada', () => {
    expect(Object.keys(api).sort()).toEqual([...EXPECTED].sort());
  });

  it('los consumidores re-exportan sin pérdida (guidedBuilderConstants)', async () => {
    const gb = await import('../guidedBuilderConstants.js');
    const names = [
      'ACCIONES_STEP1_CHIPS',
      'ACTION_FLOW_PIPELINES',
      'DEFAULT_PIPELINE',
      'getActionPipeline',
      'buildPipelinePrompt',
      'extractCleanUnit',
      'isOmitted',
    ];
    for (const n of names) {
      expect(gb[n], n).toBeDefined();
    }
  });
});
