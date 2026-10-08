import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export default function MathQuantityInput({ value, onChange, onSave, className }) {
  const formatVal = (v) => {
    if (v === null || v === undefined || v === '') return '0';
    return String(v).replace(/\./g, ',');
  };

  const [localVal, setLocalVal] = useState(() => formatVal(value));
  const [isFocused, setIsFocused] = useState(false);
  const [previewVal, setPreviewVal] = useState(null);

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(formatVal(value));
    }
  }, [value, isFocused]);

  const evaluateExpression = (expr) => {
    if (expr === '' || expr === null || expr === undefined) return 0;
    const str = String(expr).replace(/,/g, '.').trim();
    if (!/^[\d\s+\-*/().]+$/.test(str)) return null;
    try {
      const res = Function(`"use strict"; return (${str})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return Math.max(0, Math.round(res * 10000) / 10000);
      }
    } catch {
      return null;
    }
    return null;
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setLocalVal(text);

    if (/[+\-*/()]/.test(text)) {
      const evalRes = evaluateExpression(text);
      setPreviewVal(evalRes);
    } else {
      setPreviewVal(null);
    }
  };

  const handleCommit = () => {
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
    <div className="relative inline-flex items-center justify-center w-full">
      <input
        type="text"
        value={isFocused ? localVal : formatVal(value)}
        onFocus={() => {
          setIsFocused(true);
          setLocalVal(formatVal(value));
        }}
        onChange={handleInputChange}
        onBlur={handleCommit}
        onKeyDown={(e) => {
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
        title="Admite fórmulas matemáticas: ej. 12,5 * 3 o 12.5 * 3. Pulsa Enter para resolver."
        className={className}
      />
      {isFocused && previewVal !== null && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 bg-slate-900 text-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-xl z-30 pointer-events-none whitespace-nowrap flex items-center gap-1 border border-slate-700 animate-in fade-in zoom-in-95">
          <span className="text-slate-400">=</span>
          <span>{previewVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
        </div>
      )}
    </div>
  );
}
