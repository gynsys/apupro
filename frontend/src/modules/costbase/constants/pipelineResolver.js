// Resolver: devuelve el pipeline adaptativo para una acción (extraído de actionPipelines.js)
import { ACTION_FLOW_PIPELINES, DEFAULT_PIPELINE } from './pipelines/index.js';

export function getActionPipeline(accion) {
  if (!accion || typeof accion !== 'string') return DEFAULT_PIPELINE;
  const clean = accion.trim().toLowerCase();

  // Buscar coincidencia directa
  if (ACTION_FLOW_PIPELINES[clean]) {
    return ACTION_FLOW_PIPELINES[clean];
  }

  // Buscar por regex
  if (/compactac/i.test(clean)) return ACTION_FLOW_PIPELINES['compactacion'];
  if (/excavac/i.test(clean)) return ACTION_FLOW_PIPELINES['excavacion'];
  if (/demolic/i.test(clean)) return ACTION_FLOW_PIPELINES['demolicion'];
  if (/remoci[oó]n/i.test(clean)) return ACTION_FLOW_PIPELINES['remocion'];
  if (/limpieza/i.test(clean)) return ACTION_FLOW_PIPELINES['limpieza'];
  if (/transporte/i.test(clean)) return ACTION_FLOW_PIPELINES['transporte'];
  if (/acarreo/i.test(clean)) return ACTION_FLOW_PIPELINES['acarreo'];
  if (/deforest/i.test(clean)) return ACTION_FLOW_PIPELINES['deforestacion'];
  if (/rellen/i.test(clean)) return ACTION_FLOW_PIPELINES['relleno'];
  if (/vaciado|concreto/i.test(clean)) return ACTION_FLOW_PIPELINES['vaciado'];
  if (/suministr|instalac/i.test(clean)) return ACTION_FLOW_PIPELINES['instalacion'];
  if (/pintur/i.test(clean)) return ACTION_FLOW_PIPELINES['pintura'];
  if (/impermeabiliz/i.test(clean)) return ACTION_FLOW_PIPELINES['impermeabilizacion'];
  if (/coloca/i.test(clean)) return ACTION_FLOW_PIPELINES['colocacion'];
  if (/desmont/i.test(clean)) return ACTION_FLOW_PIPELINES['desmontaje'];
  if (/reparac|manten/i.test(clean)) return ACTION_FLOW_PIPELINES['reparacion'];
  if (/restaur/i.test(clean)) return ACTION_FLOW_PIPELINES['restauracion'];
  if (/saneam/i.test(clean)) return ACTION_FLOW_PIPELINES['saneamiento'];
  if (/confecc/i.test(clean)) return ACTION_FLOW_PIPELINES['confeccion'];
  if (/tratam/i.test(clean)) return ACTION_FLOW_PIPELINES['tratamiento'];
  if (/construc/i.test(clean)) return ACTION_FLOW_PIPELINES['construccion'];

  return DEFAULT_PIPELINE;
}
