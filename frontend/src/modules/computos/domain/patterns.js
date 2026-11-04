/** Patrones compartidos por el parser de cómputos. */

import { UNIT_PATTERN } from './units.js';

const CHAPTER_PREFIX_RE = /^(?:cap[ií]tulo|cap\.?)\s*[:-]?\s*(.+)$/i;

const PURE_UNIT_LINE_RE = new RegExp(
  `^(?:und\\.?|unidad\\s*[:-]?)?\\s*(${UNIT_PATTERN})\\.?$`,
  'i'
);

const MEASURE_TRAILING_RE = new RegExp(
  `[:\\s,=-]+((?:\\(?\\d+(?:[.,]\\d+)?\\)?\\s*[*xX×/+-]\\s*)+\\(?\\d+(?:[.,]\\d+)?\\)?|\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})?\\.?$`,
  'i'
);

export { CHAPTER_PREFIX_RE, PURE_UNIT_LINE_RE, MEASURE_TRAILING_RE };
