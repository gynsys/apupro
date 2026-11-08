import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export default function MathQuantityInput({
  value,
  onChange,
  onSave,
  className = '',
  placeholder = '',
  allowEmpty = false,
  readOnly = false,
  disabled = false,
  title,
  min,
  integerOnly = false,
  decimals = 2,
}) {
  const formatVal = (v) => {
    if (v === null || v === undefined || v === '') {
      return allowEmpty ? '' : '0';
    }
    const n = parseFloat(String(v).replace(',', '.'));
    if (!isNaN(n) && Number.isFinite(n)) {
      if (integerOnly) {
        return String(Math.round(n));
      }
      if (typeof decimals === 'number') {
        const factor = Math.pow(10, decimals);
        const rounded = Math.round(n * factor) / factor;
        return String(rounded).replace(/\./g, ',');
      }
    }
    return String(v).replace(/\./g, ',');
  };

  const [localVal, setLocalVal] = useState(() => formatVal(value));
  const [isFocused, setIsFocused] = useState(false);
  const [previewVal, setPreviewVal] = useState(null);

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(formatVal(value));
    }
  }, [value, isFocused, allowEmpty]);

  const evaluateExpression = (expr) => {
    if (expr === '' || expr === null || expr === undefined) {
      return allowEmpty ? '' : 0;
    }
    let str = String(expr).trim();
    if (str === '') return allowEmpty ? '' : 0;

    // Soportar '=' inicial estilo hoja de cálculo / Excel
    if (str.startsWith('=')) {
      str = str.slice(1).trim();
    }

    // Normalizar coma decimal a punto
    str = str.replace(/,/g, '.');

    // Normalizar multiplicaciones: 'x', 'X', '×'
    // Ej: "2x3", "2 x 3", "2.5 X 4", "10×2"
    str = str.replace(/(\d)\s*[xX\u00d7]\s*(\d)/g, '$1 * $2');
    str = str.replace(/\s*[xX\u00d7]\s*/g, ' * ');

    // Normalizar divisiones: '÷' o ':' entre números
    str = str.replace(/[\u00f7]/g, '/');
    str = str.replace(/(\d)\s*:\s*(\d)/g, '$1 / $2');

    // Limpiar espacios extra
    str = str.trim();

    if (!/^[\d\s+\-*/().]+$/.test(str)) return null;
    try {
      const res = Function(`"use strict"; return (${str})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        const factor = Math.pow(10, decimals);
        let finalVal = Math.round(res * factor) / factor;
        if (min !== undefined && finalVal < min) finalVal = min;
        if (integerOnly) finalVal = Math.round(finalVal);
        return finalVal;
      }
    } catch {
      return null;
    }
    return null;
  };

  const handleInputChange = (e) => {
    if (readOnly || disabled) return;
    const text = e.target.value;
    setLocalVal(text);

    // Detectar si contiene algún operador matemático o '='
    if (/[+\-*/()xX\u00d7\u00f7=]/.test(text)) {
      const evalRes = evaluateExpression(text);
      setPreviewVal(evalRes);
      if (evalRes !== null && evalRes !== undefined && onChange) {
        onChange(evalRes);
      }
    } else {
      setPreviewVal(null);
      const evaluated = evaluateExpression(text);
      if (evaluated !== null && evaluated !== undefined && onChange) {
        onChange(evaluated);
      }
    }
  };

  const handleCommit = () => {
    if (readOnly || disabled) return;
    setIsFocused(false);
    setPreviewVal(null);

    const evaluated = evaluateExpression(localVal);
    if (evaluated !== null) {
      setLocalVal(formatVal(evaluated));
      if (onChange) onChange(evaluated);
      if (onSave) onSave(evaluated);
    } else {
      setLocalVal(formatVal(value));
      if (localVal && String(localVal).trim() !== '' && String(localVal).trim() !== String(value)) {
        toast.error('Fórmula no válida. Se conservó el valor anterior.', { id: 'math-err', duration: 2000 });
      }
    }
  };

  return (
    <div className="relative inline-flex items-center justify-center w-full min-w-0">
      <input
        type="text"
        value={isFocused ? localVal : formatVal(value)}
        onFocus={() => {
          if (readOnly || disabled) return;
          setIsFocused(true);
          setLocalVal(formatVal(value));
        }}
        onChange={handleInputChange}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (readOnly || disabled) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          } else if (e.key === 'Escape') {
            setLocalVal(formatVal(value));
            setIsFocused(false);
            setPreviewVal(null);
            e.target.blur();
          }
        }}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        title={title || "Admite operaciones: ej. 2,5 * 3 o 4 + 1.2. Pulsa Enter para calcular."}
        className={`min-w-0 ${className}`}
      />
      {isFocused && previewVal !== null && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 bg-slate-900 text-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-xl z-30 pointer-events-none whitespace-nowrap flex items-center gap-1 border border-slate-700 animate-in fade-in zoom-in-95">
          <span className="text-slate-400">=</span>
          <span>
            {Number(previewVal).toLocaleString('es-VE', {
              minimumFractionDigits: integerOnly ? 0 : decimals,
              maximumFractionDigits: decimals,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
