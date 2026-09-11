import React, { useState, useEffect, useRef } from 'react';

/**
 * DecimalInput: Campo de entrada numérico decimal de alta precisión sin steppers/flechas.
 * 
 * - Usa type="text" con inputMode="decimal" (sin flechas/steppers en ningún navegador, teclado numérico en móviles).
 * - Admite tanto el punto (.) como la coma (,) como separadores decimales indistintamente.
 * - Mantiene el estado en búfer local mientras el usuario escribe para que el punto/coma no se borre ni se resetee a 0.
 * - Notifica a onChange(numericVal, syntheticEvent) en cada tecla para cálculos en tiempo real.
 * - En blur o Enter, confirma y normaliza el valor final.
 * - En focus, selecciona todo el texto para permitir sobreescribir inmediatamente.
 */
export default function DecimalInput({
  value,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  className = '',
  placeholder = '0',
  disabled = false,
  readOnly = false,
  min,
  max,
  decimals,
  allowNegative = false,
  autoSelectOnFocus = true,
  name,
  id,
  title,
  ...rest
}) {
  const formatInitial = (v) => {
    if (v === null || v === undefined || v === '') return '';
    const num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    if (isNaN(num)) return '';
    return String(v);
  };

  const [localVal, setLocalVal] = useState(() => formatInitial(value));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  // Sincronizar con el valor del padre ÚNICAMENTE cuando NO está enfocado
  useEffect(() => {
    if (!isFocused) {
      setLocalVal(formatInitial(value));
    }
  }, [value, isFocused]);

  const parseNumber = (str) => {
    if (!str || str.trim() === '' || str === '-' || str === '.' || str === ',') {
      return 0;
    }
    const normalized = str.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleInputChange = (e) => {
    let raw = e.target.value;

    // Normalizar comas a puntos
    raw = raw.replace(/,/g, '.');

    // Filtrar caracteres válidos: dígitos, un solo punto, y opcional signo negativo
    let cleaned = '';
    let hasDot = false;
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (char >= '0' && char <= '9') {
        cleaned += char;
      } else if (char === '.' && !hasDot) {
        cleaned += '.';
        hasDot = true;
      } else if (char === '-' && i === 0 && allowNegative) {
        cleaned += '-';
      }
    }

    // Limitar cantidad de decimales si se especifica
    if (decimals !== undefined && hasDot) {
      const parts = cleaned.split('.');
      if (parts[1] && parts[1].length > decimals) {
        cleaned = parts[0] + '.' + parts[1].slice(0, decimals);
      }
    }

    setLocalVal(cleaned);

    const numericVal = parseNumber(cleaned);
    if (onChange) {
      const syntheticEvent = {
        target: { value: numericVal, raw: cleaned, name },
        currentTarget: { value: numericVal, raw: cleaned, name },
        name
      };
      onChange(numericVal, syntheticEvent);
    }
  };

  const handleFocus = (e) => {
    setIsFocused(true);
    if (autoSelectOnFocus && e.target && typeof e.target.select === 'function') {
      setTimeout(() => {
        try {
          e.target.select();
        } catch (_) {}
      }, 0);
    }
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    let finalNumeric = parseNumber(localVal);

    if (min !== undefined && finalNumeric < min) finalNumeric = min;
    if (max !== undefined && finalNumeric > max) finalNumeric = max;

    const finalStr = localVal.trim() === '' 
      ? (min !== undefined ? String(min) : '') 
      : String(finalNumeric);

    setLocalVal(finalStr);

    if (onBlur) {
      const syntheticEvent = {
        target: { value: finalNumeric, raw: finalStr, name },
        currentTarget: { value: finalNumeric, raw: finalStr, name },
        name
      };
      onBlur(finalNumeric, syntheticEvent);
    }
  };

  const handleKeyDownInternal = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setLocalVal(formatInitial(value));
      setIsFocused(false);
      e.target.blur();
    }
    if (onKeyDown) onKeyDown(e);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck="false"
      name={name}
      id={id}
      title={title}
      className={className}
      value={isFocused ? localVal : formatInitial(value)}
      onChange={handleInputChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDownInternal}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      {...rest}
    />
  );
}
