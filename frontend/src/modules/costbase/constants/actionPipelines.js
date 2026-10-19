// Barrel público de actionPipelines (re-exporta la API completa a los consumidores)
export { isOmitted, extractCleanUnit } from './helpers.js';
export { ACCIONES_STEP1_CHIPS } from './actionList.js';
export { ACTION_FLOW_PIPELINES, DEFAULT_PIPELINE } from './pipelines/index.js';
export { getActionPipeline } from './pipelineResolver.js';
export { buildPipelinePrompt } from './pipelinePrompt.js';
