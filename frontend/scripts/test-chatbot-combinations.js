/**
 * test-chatbot-combinations.js
 * 
 * Script de prueba exhaustiva para el Chatbot Asistente Guiado de APUPro.
 * Recorre el árbol de decisión completo de los 23 chips de acción principales,
 * evaluando cada bifurcación, chips dinámicos, coherencia semántica,
 * extracción de unidades y generación final de la descripción técnica.
 */

import {
  ACCIONES_STEP1_CHIPS,
  getActionPipeline,
  buildPipelinePrompt,
  extractCleanUnit,
  isOmitted
} from '../src/modules/costbase/constants/actionPipelines.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Heurísticas de inconsistencia semántica para auditoría
const INCOMPATIBILITY_RULES = [
  {
    name: 'Saneamiento: Trampa de grasa con pedraplén o PEAD',
    check: (answers) => {
      const answersStr = JSON.stringify(answers).toLowerCase();
      const isGreaseTrap = answersStr.includes('trampa') || answersStr.includes('grasa');
      const hasUnrelated = answersStr.includes('pedraplén') || answersStr.includes('geotextil') || answersStr.includes('pead');
      return isGreaseTrap && hasUnrelated;
    }
  },
  {
    name: 'Saneamiento: Fosa séptica con pedraplén o PEAD',
    check: (answers) => {
      const answersStr = JSON.stringify(answers).toLowerCase();
      const isSeptic = answersStr.includes('fosa') || answersStr.includes('séptica');
      const hasUnrelated = answersStr.includes('pedraplén') || answersStr.includes('geotextil') || answersStr.includes('pead');
      return isSeptic && hasUnrelated;
    }
  },
  {
    name: 'Limpieza: Terreno con desengrase químico de pisos',
    check: (answers) => {
      const answersStr = JSON.stringify(answers).toLowerCase();
      const isTerrain = answersStr.includes('terreno con maleza') || answersStr.includes('terreno con escombros');
      const hasDegreaser = answersStr.includes('desengrase químico profundo');
      return isTerrain && hasDegreaser;
    }
  },
  {
    name: 'Impermeabilización: Tanque o foso con pintura de aluminio reflectiva solar',
    check: (answers) => {
      const answersStr = JSON.stringify(answers).toLowerCase();
      const isSubterranean = answersStr.includes('tanque') || answersStr.includes('foso') || answersStr.includes('muro');
      const hasReflectiveSolar = answersStr.includes('pintura de aluminio reflectiva');
      return isSubterranean && hasReflectiveSolar;
    }
  },
  {
    name: 'Colocación: Puertas o techos con emboquillado de pastina de cerámica',
    check: (answers) => {
      const answersStr = JSON.stringify(answers).toLowerCase();
      const isDoorOrRoof = answersStr.includes('puerta') || answersStr.includes('ventana') || answersStr.includes('techo');
      const hasPastina = answersStr.includes('emboquillado con pastina');
      return isDoorOrRoof && hasPastina;
    }
  },
  {
    name: 'Restauración: Madera con cal hidráulica o metales con aceites',
    check: (answers) => {
      const answersStr = JSON.stringify(answers).toLowerCase();
      const isWood = answersStr.includes('madera') || answersStr.includes('portón');
      const hasLime = answersStr.includes('cal hidráulica');
      return isWood && hasLime;
    }
  },
  {
    name: 'Pintura: Pisos/pavimentos con esmalte o anticorrosivo de metal',
    check: (answers) => {
      const answersStr = JSON.stringify(answers).toLowerCase();
      const isFloor = answersStr.includes('pisos de concreto') || answersStr.includes('pavimentos');
      const hasMetalPaint = answersStr.includes('anticorrosivo') || answersStr.includes('cromato') || answersStr.includes('esmalte sintético');
      return isFloor && hasMetalPaint;
    }
  },
  {
    name: 'Pintura: Metal con pintura de caucho de pared o epóxico de piso',
    check: (answers) => {
      const answersStr = JSON.stringify(answers).toLowerCase();
      const isMetal = answersStr.includes('rejas') || answersStr.includes('puertas metálicas') || answersStr.includes('estructuras metálicas');
      const hasWallOrFloor = answersStr.includes('caucho clase') || answersStr.includes('epóxica autonivelante');
      return isMetal && hasWallOrFloor;
    }
  },
  {
    name: 'Colocación: Porcelanato/cerámica con soldadura',
    check: (answers) => {
      const answersStr = JSON.stringify(answers).toLowerCase();
      const isCeramic = answersStr.includes('cerámica') || answersStr.includes('porcelanato') || answersStr.includes('azulejo');
      const hasWeld = answersStr.includes('soldadura') || answersStr.includes('e6013');
      return isCeramic && hasWeld;
    }
  }
];

// Estadísticas de ejecución
const stats = {
  totalActions: ACCIONES_STEP1_CHIPS.length,
  totalPathsTested: 0,
  actionStats: {},
  anomalies: [],
  sampleOutputs: []
};

console.log('='.repeat(80));
console.log('INICIANDO AUDITORÍA EXHAUSTIVA DE COMBINACIONES DEL CHATBOT GUIADO');
console.log(`Total de acciones principales a evaluar: ${stats.totalActions}`);
console.log('='.repeat(80));

for (const action of ACCIONES_STEP1_CHIPS) {
  const pipeline = getActionPipeline(action);
  let actionPaths = 0;
  let actionAnomalies = 0;

  if (!pipeline || pipeline.length === 0) {
    stats.anomalies.push({
      action,
      type: 'PIPELINE_VACIO',
      message: `La acción '${action}' no tiene un pipeline de pasos definido.`
    });
    continue;
  }

  // Exploración en profundidad (DFS) de todas las combinaciones
  function traverse(stepIndex, currentAnswers) {
    if (stepIndex >= pipeline.length) {
      // Llegamos al final de una ruta completa
      actionPaths++;
      stats.totalPathsTested++;

      // Validar ensamblaje del prompt
      const result = buildPipelinePrompt(action, currentAnswers, pipeline);

      if (!result.finalPrompt || result.finalPrompt.trim() === '') {
        stats.anomalies.push({
          action,
          type: 'PROMPT_VACIO',
          answers: { ...currentAnswers },
          message: 'El prompt generado está vacío.'
        });
        actionAnomalies++;
      }

      if (result.finalPrompt.includes('undefined') || result.finalPrompt.includes('null') || result.finalPrompt.includes('[object')) {
        stats.anomalies.push({
          action,
          type: 'VALOR_INVALIDO_EN_PROMPT',
          prompt: result.finalPrompt,
          answers: { ...currentAnswers },
          message: 'El prompt contiene tokens no deseados (undefined, null, [object]).'
        });
        actionAnomalies++;
      }

      // Validar extracción de unidad si el pipeline contempla unidad
      const hasUnitStep = pipeline.some((s) => s.isUnit);
      if (hasUnitStep && !result.unit && !result.isGlobal) {
        const unitStep = pipeline.find((s) => s.isUnit);
        const unitAns = currentAnswers[unitStep.id];
        if (unitAns && !isOmitted(unitAns)) {
          stats.anomalies.push({
            action,
            type: 'UNIDAD_NO_EXTRAIDA',
            unitAnswer: unitAns,
            answers: { ...currentAnswers },
            message: `No se pudo normalizar la unidad desde '${unitAns}'`
          });
          actionAnomalies++;
        }
      }

      // Verificar reglas de inconsistencia semántica
      for (const rule of INCOMPATIBILITY_RULES) {
        if (rule.check(currentAnswers)) {
          stats.anomalies.push({
            action,
            type: 'INCONSISTENCIA_SEMANTICA',
            rule: rule.name,
            answers: { ...currentAnswers },
            prompt: result.finalPrompt,
            message: `Combinación incompatible detectada: ${rule.name}`
          });
          actionAnomalies++;
        }
      }

      // Guardar una muestra cada ~75 rutas para el reporte
      if (actionPaths === 1 || actionPaths % 75 === 0) {
        stats.sampleOutputs.push({
          action,
          pathIndex: actionPaths,
          prompt: result.finalPrompt,
          unit: result.unit,
          isGlobal: result.isGlobal
        });
      }

      return;
    }

    const currentStep = pipeline[stepIndex];
    let chips = [];

    try {
      chips = typeof currentStep.chips === 'function' ? currentStep.chips(currentAnswers) : currentStep.chips;
    } catch (err) {
      stats.anomalies.push({
        action,
        stepId: currentStep.id,
        type: 'ERROR_EJECUCION_CHIPS',
        message: `Error al calcular chips: ${err.message}`,
        answers: { ...currentAnswers }
      });
      actionAnomalies++;
      return;
    }

    if (!Array.isArray(chips) || chips.length === 0) {
      stats.anomalies.push({
        action,
        stepId: currentStep.id,
        type: 'CHIPS_VACIOS',
        message: `El paso '${currentStep.id}' devolvió un arreglo vacío de chips.`,
        answers: { ...currentAnswers }
      });
      actionAnomalies++;
      return;
    }

    // Verificar si hay chips compuestos no atómicos indeseados (ej: ' / ' o ' y ')
    for (const chip of chips) {
      if (typeof chip !== 'string') {
        stats.anomalies.push({
          action,
          stepId: currentStep.id,
          type: 'CHIP_NO_STRING',
          chip,
          answers: { ...currentAnswers }
        });
        actionAnomalies++;
        continue;
      }

      // Redundancia conocida: 'a mano de obra'
      if (chip.toLowerCase().includes('manual a mano de obra') || chip.toLowerCase().includes('equipo mecánico y')) {
        stats.anomalies.push({
          action,
          stepId: currentStep.id,
          type: 'REDUNDANCIA_DETECTADA',
          chip,
          message: `El chip '${chip}' contiene redundancias innecesarias de lenguaje.`
        });
        actionAnomalies++;
      }

      // Heurística de doble opción compuesta con barra
      if (chip.includes(' / ') && !chip.includes('ninguno') && !chip.includes('rana') && !chip.includes('malacate') && !chip.includes('güinche')) {
        stats.anomalies.push({
          action,
          stepId: currentStep.id,
          type: 'CHIP_COMPUESTO_BARRA',
          chip,
          message: `El chip '${chip}' contiene una barra oblicua ' / ' que sugiere opciones dobles no atómicas.`
        });
        actionAnomalies++;
      }
    }

    // Ramificar para cada chip
    for (const chip of chips) {
      currentAnswers[currentStep.id] = chip;
      traverse(stepIndex + 1, currentAnswers);
      delete currentAnswers[currentStep.id];
    }
  }

  // Iniciar recorrido para la acción
  traverse(0, {});

  stats.actionStats[action] = {
    steps: pipeline.length,
    totalCombinations: actionPaths,
    anomaliesFound: actionAnomalies
  };

  const statusTag = actionAnomalies === 0 ? '[✔]' : '[❌]';
  console.log(`${statusTag} Acción: "${action.padEnd(26)}" | Pasos: ${pipeline.length} | Combinaciones: ${actionPaths.toString().padStart(6)} | Anomalías: ${actionAnomalies}`);
}

console.log('='.repeat(80));
console.log(`AUDITORÍA COMPLETADA: ${stats.totalPathsTested.toLocaleString()} combinaciones evaluadas.`);
console.log(`Total de anomalías e inconsistencias detectadas: ${stats.anomalies.length}`);
console.log('='.repeat(80));

// Escribir reporte completo en disco
const reportPath = path.resolve(__dirname, '../../test_chatbot_report.json');
fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2), 'utf-8');
console.log(`Reporte detallado guardado en: ${reportPath}`);
