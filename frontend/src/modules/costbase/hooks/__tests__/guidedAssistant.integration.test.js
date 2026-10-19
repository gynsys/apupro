/**
 * PRUEBAS 7 y 8 — Integración del asistente guiado y snapshot E2E del prompt.
 *
 * PRUEBA 7: conecta el data de pipelines con el comportamiento del asistente
 * (funciones puras + getDynamicStepDefinition) para confirmar que la
 * refactorización no rompió el puente dato → lógica → UI guiada.
 *
 * PRUEBA 8: simula el flujo guiado completo (recorriendo el árbol de decisión
 * dinámico) para un set representativo de acciones y congela el prompt final.
 * Es un golden E2E: si el refactor cambia el prompt, el snapshot salta.
 *
 * Requiere entorno jsdom (react-hot-toast / react se importan vía el hook).
 */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  isGibberish,
  isComprehensiveDescription,
  decomposeComprehensivePrompt,
  validateStepInput,
  analyzeDescriptionCompleteness,
  createGuidedInitialMessage
} from '../useGuidedAssistant.js';
import { getDynamicStepDefinition } from '../../constants/guidedBuilderConstants.js';
import {
  getActionPipeline,
  buildPipelinePrompt,
  isOmitted,
} from '../../constants/actionPipelines.js';

// ============================================================================
// PRUEBA 7 — Integración: pipeline → asistente guiado
// ============================================================================
describe('PRUEBA 7 — Integración del asistente guiado', () => {
  describe('isGibberish (guarda basura / teclado aporreado)', () => {
    it('rechaza basura', () => {
      for (const junk of ['x', 'asdf', 'qwer', '1234', 'aaaa', 'xxx', '!!!', 'zxcv']) {
        expect(isGibberish(junk), JSON.stringify(junk)).toBe(true);
      }
    });
    it('acepta textos válidos', () => {
      expect(isGibberish('Construcción de pared de bloques')).toBe(false);
      expect(isGibberish('Pintura de techo')).toBe(false);
    });
  });

  describe('isComprehensiveDescription (detecta párrafo completo de APU)', () => {
    it('detecta descripciones completas', () => {
      const full =
        'Vaciado de concreto para losa maciza de 15cm incluyendo vibrado mecánico, curado con agua y aditivo desencofrante';
      expect(isComprehensiveDescription(full)).toBe(true);
    });
    it('descarta frases cortas o ambiguas', () => {
      expect(isComprehensiveDescription('hola')).toBe(false);
      expect(isComprehensiveDescription('casa')).toBe(false);
    });
  });

  describe('decomposeComprehensivePrompt (desglosa párrafo en los pasos)', () => {
    it('descompone acción / material', () => {
      const r = decomposeComprehensivePrompt('Vaciado de concreto para losa');
      expect(r.accion).toMatch(/vaciado/i);
      expect(r.material).toMatch(/concreto/i);
      expect(r.ubicacion).toMatch(/losa/i);
    });
    it('descompone cláusula incluye', () => {
      const r = decomposeComprehensivePrompt(
        'Pintura de pared incluyendo preparación de superficie, lijado y aplicación de 2 manos'
      );
      expect(r.accion).toMatch(/pintura/i);
      expect(r.incluye).toMatch(/incluye/i);
    });
  });

  describe('validateStepInput (validación estricta por paso)', () => {
    it('rechaza vacíos', () => {
      const r = validateStepInput('', 1);
      expect(r.isValid).toBe(false);
    });
    it('acepta respuesta válida', () => {
      const r = validateStepInput('Construcción', 1);
      expect(r.isValid).toBe(true);
    });
    it('rechaza basura tipo gibberish', () => {
      const r = validateStepInput('asdf', 1);
      expect(r.isValid).toBe(false);
    });
  });

  describe('getDynamicStepDefinition (puente pipeline → pasos de UI guiada)', () => {
    it('entrega definición válida para los 6 pasos', () => {
      const ctx = { accion: 'Construcción', elemento: 'Paredes de bloques de arcilla' };
      for (let step = 1; step <= 6; step++) {
        const def = getDynamicStepDefinition(step, ctx);
        expect(def, `paso ${step}`).toBeDefined();
        expect(typeof def.text, `paso ${step} text`).toBe('string');
        expect(def.chips !== undefined, `paso ${step} chips`).toBe(true);
      }
    });
  });

  describe('analyzeDescriptionCompleteness (análisis de revisión y completitud)', () => {
    it('rechaza entradas inválidas o tipo gibberish', () => {
      expect(analyzeDescriptionCompleteness('asdf').isValid).toBe(false);
      expect(analyzeDescriptionCompleteness('').isValid).toBe(false);
      expect(analyzeDescriptionCompleteness(null).isValid).toBe(false);
    });

    it('identifica descripción incompleta sin acción constructiva', () => {
      const r = analyzeDescriptionCompleteness('bloques de arcilla de 15cm');
      expect(r.hasAction).toBe(false);
      expect(r.hasElement).toBe(true);
      expect(r.isComplete).toBe(false);
    });

    it('analiza descripción completa sin unidad y marca completitud', () => {
      const r = analyzeDescriptionCompleteness(
        'Construcción de pared de bloques de arcilla de 15cm con mortero 1:3 acabado corriente'
      );
      expect(r.isValid).toBe(true);
      expect(r.hasAction).toBe(true);
      expect(r.hasElement).toBe(true);
      expect(r.hasSpecs).toBe(true);
      expect(r.isComplete).toBe(true);
      expect(r.detectedUnit).toBeNull();
    });

    it('detecta unidades explícitas en el texto', () => {
      const r1 = analyzeDescriptionCompleteness('Vaciado de losa de concreto e=15cm en m2');
      expect(r1.detectedUnit).toBe('m2');

      const r2 = analyzeDescriptionCompleteness('Suministro e instalación de transformador 50kVA, unidad: und');
      expect(r2.detectedUnit).toBe('und');

      const r3 = analyzeDescriptionCompleteness('Limpieza de terreno general, Gl');
      expect(r3.detectedUnit).toBe('Gl');
    });

    it('detecta especificaciones técnicas de dimensiones, mezclas y cláusulas', () => {
      const r = analyzeDescriptionCompleteness(
        'Vaciado de concreto f\'c=250 kg/cm2 para losa e=15cm incluyendo vibrado mecánico'
      );
      expect(r.hasSpecs).toBe(true);
      expect(r.specs).toContain('15cm');
      expect(r.specs).toContain("f'c=250");
      expect(r.isComplete).toBe(true);
    });
  });

  describe('createGuidedInitialMessage (Paso 0 - Chips de bienvenida)', () => {
    it('incluye botón "Escribir libremente" al lado de "Sí, comenzar" en el mensaje inicial', () => {
      const msg = createGuidedInitialMessage({ full_name: 'Pablo' });
      expect(msg.chips).toEqual(['Sí, comenzar', 'Escribir libremente']);
      expect(msg.text).toContain('¡Hola Pablo!');
    });

    it('genera saludo genérico si no hay usuario especificado', () => {
      const msg = createGuidedInitialMessage(null);
      expect(msg.chips).toEqual(['Sí, comenzar', 'Escribir libremente']);
      expect(msg.text).toContain('¡Hola!');
    });
  });
});

// ============================================================================
// PRUEBA 8 — Snapshot E2E: flujo guiado completo → prompt final
// Recorre el pipeline real (chips dinámicos dependientes de pasos previos),
// arma el prompt y lo congela como golden.
// ============================================================================
describe('PRUEBA 8 — Snapshot E2E del prompt guiado', () => {
  // Simula que el usuario elige la primera opción NO omitida de cada paso,
  // alimentando las opciones dinámicas con las respuestas previas.
  function simulateGuidedFlow(accion) {
    const pipeline = getActionPipeline(accion);
    const answers = {};
    for (const step of pipeline) {
      if (step.isUnit) {
        answers[step.id] = 'm²';
        continue;
      }
      const options = typeof step.chips === 'function' ? step.chips(answers) : step.chips;
      const chosen = (options || []).find((c) => !isOmitted(c)) || 'Omitir';
      answers[step.id] = chosen;
    }
    const { finalPrompt, unit } = buildPipelinePrompt(accion, answers, pipeline);
    return {
      accion,
      steps: pipeline.map((s) => s.id),
      finalPrompt,
      unit,
    };
  }

  const accionesRepresentativas = [
    'compactación',
    'excavación',
    'demolición',
    'pintura',
    'instalación',
    'vaciado de concreto',
    'saneamiento',
    'confección',
    'reparación',
    'construcción',
  ];

  it.each(accionesRepresentativas)('golden: %s', (accion) => {
    expect(simulateGuidedFlow(accion)).toMatchSnapshot();
  });
});
