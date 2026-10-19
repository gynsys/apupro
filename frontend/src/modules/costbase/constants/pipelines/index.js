// Agregador de pipelines por familia constructiva
import { PIPELINES as movimientoTierras } from './movimientoTierras.js';
import { PIPELINES as demolicionYRemocion } from './demolicionYRemocion.js';
import { PIPELINES as limpiezaYSaneamiento } from './limpiezaYSaneamiento.js';
import { PIPELINES as logisticaYSitio } from './logisticaYSitio.js';
import { PIPELINES as construccion } from './construccion.js';
import { PIPELINES as instalacion } from './instalacion.js';
import { PIPELINES as recubrimientos } from './recubrimientos.js';
import { PIPELINES as reparacionRestauracion } from './reparacionRestauracion.js';
import { PIPELINES as confeccion } from './confeccion.js';

export const ACTION_FLOW_PIPELINES = Object.assign({},
  movimientoTierras,
   demolicionYRemocion,
   limpiezaYSaneamiento,
   logisticaYSitio,
   construccion,
   instalacion,
   recubrimientos,
   reparacionRestauracion,
   confeccion
);

// Alias históricos que apuntan a pipelines ya existentes
ACTION_FLOW_PIPELINES['mantenimiento'] = ACTION_FLOW_PIPELINES['reparacion'];
ACTION_FLOW_PIPELINES['suministro e instalacion'] = ACTION_FLOW_PIPELINES['instalacion'];
ACTION_FLOW_PIPELINES['suministro e instalación'] = ACTION_FLOW_PIPELINES['instalacion'];
ACTION_FLOW_PIPELINES['vaciado de concreto'] = ACTION_FLOW_PIPELINES['vaciado'];

export { DEFAULT_PIPELINE } from './default.js';
