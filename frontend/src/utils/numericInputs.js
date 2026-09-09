/**
 * Configuración global para entradas numéricas en CostBase.
 * 
 * 1. Permite usar tanto el punto (.) como la coma (,) indistintamente como separadores decimales.
 * 2. Asigna step="any" a inputs numéricos al recibir foco para evitar bloqueos nativos de decimales.
 * 3. Parchea globalmente parseFloat y Number.parseFloat para procesar tanto "10.5" como "10,5".
 * 4. Intercepta el pegado (paste) y beforeinput para normalizar comas decimales a puntos.
 */

function insertDecimalPoint(input) {
  if (!input) return;
  const currentVal = input.value || '';
  if (currentVal.includes('.')) {
    return; // Ya posee un punto decimal
  }

  let success = false;
  try {
    success = document.execCommand('insertText', false, '.');
  } catch (_) {
    success = false;
  }

  if (!success) {
    try {
      const origType = input.type;
      input.type = 'text';
      const start = input.selectionStart ?? currentVal.length;
      const end = input.selectionEnd ?? currentVal.length;
      input.value = currentVal.substring(0, start) + '.' + currentVal.substring(end);
      input.selectionStart = input.selectionEnd = start + 1;
      input.type = origType;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      success = true;
    } catch (_) {
      input.value = currentVal + '.';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

export function initGlobalNumericInputHandlers() {
  if (typeof window === 'undefined') return;

  // 1. Asegurar step="any" en todos los inputs numéricos al recibir foco
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT' && target.type === 'number') {
      if (!target.hasAttribute('step')) {
        target.setAttribute('step', 'any');
      }
    }
  }, true);

  // 2. Interceptar pulsaciones de coma (,) en inputs numéricos
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;

    const isNumeric = target.type === 'number' || 
                      target.inputMode === 'decimal' || 
                      target.inputMode === 'numeric' ||
                      target.classList.contains('hide-spinners');

    if (!isNumeric) return;

    if (e.key === ',' || e.keyCode === 188 || e.key === 'Decimal') {
      if (target.type === 'number') {
        e.preventDefault();
        insertDecimalPoint(target);
      }
    }
  }, true);

  // 3. Interceptar beforeinput para teclados móviles y virtuales
  document.addEventListener('beforeinput', (e) => {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;

    if (target.type === 'number' && e.data === ',') {
      e.preventDefault();
      insertDecimalPoint(target);
    }
  }, true);

  // 4. Interceptar pegado de texto con comas decimales
  document.addEventListener('paste', (e) => {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;

    const isNumeric = target.type === 'number' || 
                      target.inputMode === 'decimal' || 
                      target.inputMode === 'numeric';

    if (!isNumeric) return;

    const pastedText = (e.clipboardData || window.clipboardData)?.getData('text');
    if (pastedText && pastedText.includes(',')) {
      e.preventDefault();
      let normalized = pastedText.trim();
      if (normalized.includes('.') && normalized.includes(',')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = normalized.replace(',', '.');
      }

      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, normalized);
      } catch (_) {
        inserted = false;
      }

      if (!inserted) {
        target.value = normalized;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, true);

  // 5. Parchear globalmente parseFloat y Number.parseFloat
  if (!window.__numericInputsInitialized) {
    window.__numericInputsInitialized = true;
    const origParseFloat = window.parseFloat;
    const enhancedParseFloat = function (val) {
      if (typeof val === 'string' && val.includes(',')) {
        let clean = val.trim();
        if (clean.includes('.') && clean.includes(',')) {
          clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
          clean = clean.replace(',', '.');
        }
        return origParseFloat(clean);
      }
      return origParseFloat(val);
    };

    window.parseFloat = enhancedParseFloat;
    Number.parseFloat = enhancedParseFloat;
  }
}

/**
 * Parsea un número aceptando formatos con punto o coma decimal de forma segura.
 */
export function parseDecimal(val, defaultValue = 0) {
  if (val === null || val === undefined || val === '') return defaultValue;
  if (typeof val === 'number') return isNaN(val) ? defaultValue : val;
  const parsed = window.parseFloat(val);
  return isNaN(parsed) ? defaultValue : parsed;
}
