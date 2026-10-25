import React from 'react';
import { createPortal } from 'react-dom';

function excelRound(value, digits = 2) {
  const num = Number(value) || 0;
  const factor = Math.pow(10, digits);
  const scaled = Math.abs(num) * factor;
  const rounded = Math.floor(scaled + 0.5) / factor;
  return num >= 0 ? rounded : -rounded;
}

function numeroALetras(numero) {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const diezDiecinueve = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const veintes = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  const leerDecenas = (n) => {
    if (n < 10) return unidades[n];
    if (n < 20) return diezDiecinueve[n - 10];
    if (n < 30) return veintes[n - 20];
    const u = n % 10;
    if (u === 0) return decenas[Math.floor(n / 10)];
    return `${decenas[Math.floor(n / 10)]} Y ${unidades[u]}`;
  };

  const leerCentenas = (n) => {
    if (n === 100) return 'CIEN';
    return `${centenas[Math.floor(n / 100)]} ${leerDecenas(n % 100)}`.trim();
  };

  const leerMiles = (n) => {
    if (n === 0) return '';
    if (n === 1) return 'MIL';
    return `${leerCentenas(n)} MIL`.trim();
  };

  const leerMillones = (n) => {
    if (n === 0) return '';
    if (n === 1) return 'UN MILLÓN';
    if (n > 1) return `${leerCentenas(n)} MILLONES`.trim();
    return '';
  };

  const cleanNum = Math.max(0, Number(numero) || 0);
  const entero = Math.floor(cleanNum);
  const decimales = Math.round((cleanNum - entero) * 100);
  const decStr = String(decimales).padStart(2, '0');

  if (entero === 0) {
    return `CERO CON ${decStr}/100`;
  }

  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const cientos = entero % 1000;

  const partes = [];
  if (millones > 0) partes.push(leerMillones(millones));
  if (miles > 0) partes.push(leerMiles(miles));
  if (cientos > 0) partes.push(leerCentenas(cientos));

  const letras = partes.join(' ').trim();
  return `${letras} CON ${decStr}/100`;
}

function formatDateMmDdYy(dateInput) {
  const d = dateInput instanceof Date && !isNaN(dateInput) ? dateInput : new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}-${dd}-${yy}`;
}

export function APUPrintSheet({ partida, materiales = [], equipos = [], mano_obra = [], options = {} }) {
  if (!partida) return null;

  const currCode = String(options?.currency || partida?.currency || 'USD').trim().toUpperCase();
  const isUsd = currCode.includes('USD') || currCode.includes('$');
  const exRate = (!isUsd && (currCode === 'BS' || currCode === 'BS.' || currCode === 'BSF'))
    ? (parseFloat(options?.exchange_rate ?? partida.exchange_rate) || 1.0)
    : 1.0;

  const matInflation = parseFloat(options?.material_inflation ?? partida.material_inflation ?? 0) || 0;
  const eqInflation = parseFloat(options?.equipment_inflation ?? partida.equipment_inflation ?? 0) || 0;
  const labInflation = parseFloat(options?.labor_inflation ?? partida.labor_inflation ?? 0) || 0;

  const rendimiento = parseFloat(partida.RenPar ?? partida.rendimiento ?? partida.performance ?? 1.0) || 1.0;
  const cantidadRaw = parseFloat(partida.CanPar ?? partida.cantidad ?? partida.quantity ?? 1.0);
  const cantidad = cantidadRaw > 0 ? cantidadRaw : 1.0;
  const descripcion = String(
    partida.DesPar ?? partida.descripcion ?? partida.description ?? partida.Descri ?? 'N/A'
  ).replace(/\\/g, '/').replace(/\s+/g, ' ').trim();

  const rawCodigo = String(
    partida.cov_par ?? partida.CovPar ?? partida.codigo_covenin ?? partida.CodPar ?? partida.cod_par ?? partida.codigo ?? partida.code ?? ''
  ).trim();
  const partNum = parseInt(options?.part_num ?? options?.partNumber ?? partida?.partNumber ?? partida?.part_num ?? 1, 10) || 1;
  const isPlaceholderCode = !rawCodigo || ['S/C', 'SC', 'SIN CODIGO', 'SIN CÓDIGO', 'N/A', 'NA'].includes(rawCodigo.toUpperCase()) || rawCodigo.toUpperCase().startsWith('S/C');
  const codigo = isPlaceholderCode ? `APU${String(partNum).padStart(3, '0')}` : rawCodigo;
  const unidad = String(partida.UniPar ?? partida.unidad ?? partida.unit ?? 'UND').trim();

  const adminGg = parseFloat(options?.admin_percent ?? partida.admin_percent ?? partida.settings?.admin_percent ?? 15.0);
  const imprevistoUt = parseFloat(options?.profit_percent ?? options?.util_percent ?? partida.profit_percent ?? partida.util_percent ?? partida.settings?.profit_percent ?? 10.0);
  const financiamiento = parseFloat(options?.financiamiento ?? partida.financiamiento ?? partida.settings?.financiamiento ?? 0.0);
  const iva = parseFloat(options?.iva_percent ?? partida.iva_percent ?? partida.settings?.iva_percent ?? 16.0);
  const otrosImp = parseFloat(options?.otros_imp ?? partida.otros_imp ?? partida.settings?.otros_imp ?? 0.0);
  const prestaciones = parseFloat(options?.fcas_percent ?? partida.fcas_percent ?? partida.settings?.fcas_percent ?? 417.0);

  const rawBonoInFcas = options?.bono_in_fcas ?? partida?.bono_in_fcas ?? partida?.settings?.bono_in_fcas;
  const bonoInFcas = rawBonoInFcas === true || (rawBonoInFcas !== false && prestaciones >= 1000);
  const defaultLaborBonus = bonoInFcas ? 0.0 : (parseFloat(
    options?.labor_bonus ?? options?.fcasLaborBonus ?? options?.laborBonus ?? partida?.labor_bonus ?? partida?.laborBonus ?? 0.0
  ) || 0.0);

  const obra = String(options?.project_name ?? options?.obra ?? partida.project_name ?? partida.obra ?? '').trim();
  const contratante = String(options?.client_name ?? options?.contratante ?? partida.client_name ?? partida.contratante ?? '').trim();
  const fechaStr = formatDateMmDdYy(new Date());

  const fmt2 = (val) => excelRound(val, 2).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt4 = (val) => excelRound(val, 4).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const fmt6 = (val) => excelRound(val, 6).toLocaleString('es-VE', { minimumFractionDigits: 6, maximumFractionDigits: 6 });

  // Cálculos idénticos a build_apu_sheet en export_utils.py
  const computedMats = (materiales || []).map((m, idx) => {
    const cant = parseFloat(m.CanIns ?? m.cantidad ?? m.quantity ?? 0) || 0;
    const desp = parseFloat(m.Desper ?? m.desperdicio ?? m.waste ?? 0) || 0;
    const basePrecio = parseFloat(m.CosMat ?? m.precio_unitario ?? m.precio ?? m.price ?? 0) || 0;
    const precio = basePrecio * exRate * (1 + matInflation / 100);
    const total = excelRound((precio * cant) * ((desp / 100) + 1), 2);
    return {
      no: idx + 1,
      desc: String(m.Descri ?? m.descripcion ?? m.description ?? '').replace(/\\/g, '/').trim(),
      und: String(m.UniMat ?? m.unidad ?? m.unit ?? '').trim(),
      cant,
      desp,
      precio,
      total,
    };
  });
  const totalMat = excelRound(computedMats.reduce((acc, m) => acc + m.total, 0), 2);

  const computedEqs = (equipos || []).map((e, idx) => {
    const cant = parseFloat(e.CanIns ?? e.cantidad ?? e.quantity ?? 0) || 0;
    const deprec = parseFloat(e.Deprec ?? e.depreciacion ?? e.depreciation ?? 1) || 1;
    const basePrecio = parseFloat(e.CosDia ?? e.precio_unitario ?? e.precio ?? e.price ?? 0) || 0;
    const precio = basePrecio * exRate * (1 + eqInflation / 100);
    const total = excelRound((precio * cant) * deprec, 2);
    return {
      no: idx + 1,
      desc: String(e.Descri ?? e.descripcion ?? e.description ?? '').replace(/\\/g, '/').trim(),
      cant,
      deprec,
      precio,
      total,
    };
  });
  const totalEq = excelRound(computedEqs.reduce((acc, e) => acc + e.total, 0), 2);
  const cuoEq = excelRound(totalEq / rendimiento, 2);

  const resolveLabBono = (l) => {
    if (bonoInFcas) return 0.0;
    const raw = l.bono ?? l.Bono ?? l.labor_bonus ?? l.bonus;
    const parsed = raw !== null && raw !== undefined && String(raw).trim() !== '' ? parseFloat(raw) : 0.0;
    const val = !isNaN(parsed) && parsed > 0 ? parsed : defaultLaborBonus;
    return val * exRate * (1 + labInflation / 100);
  };

  const computedLabs = (mano_obra || []).map((l, idx) => {
    const cant = parseFloat(l.CanIns ?? l.cantidad ?? l.quantity ?? 0) || 0;
    const baseJornal = parseFloat(l.Jornal ?? l.jornal ?? 0) || 0;
    const jornal = baseJornal * exRate * (1 + labInflation / 100);
    const bono = resolveLabBono(l);
    const totJornal = excelRound(cant * jornal, 2);
    const totBono = excelRound(cant * bono, 2);
    return {
      no: idx + 1,
      desc: String(l.Descri ?? l.descripcion ?? l.description ?? '').replace(/\\/g, '/').trim(),
      cant,
      jornal,
      bono,
      totJornal,
      totBono,
    };
  });

  const totalMoJornal = excelRound(computedLabs.reduce((acc, l) => acc + l.totJornal, 0), 2);
  const totalMoBono = excelRound(computedLabs.reduce((acc, l) => acc + l.totBono, 0), 2);
  const moPs = excelRound((prestaciones / 100.0) * totalMoJornal, 2);
  const totalMo = excelRound(totalMoJornal + totalMoBono + moPs, 2);
  const cuoMo = excelRound(totalMo / rendimiento, 2);
  const otrosMoVal = excelRound((totalMo * otrosImp) / 100.0, 2);

  const cdVal = excelRound(totalMat + cuoEq + cuoMo, 2);
  const adVal = excelRound((cdVal * adminGg) / 100.0, 2);
  const sbVal = excelRound(cdVal + adVal, 2);
  const iuVal = excelRound((sbVal * imprevistoUt) / 100.0, 2);
  const scVal = excelRound(sbVal + iuVal, 2);
  const finVal = excelRound((scVal * financiamiento) / 100.0, 2);
  const psVal = excelRound(scVal + finVal, 2);
  const ivaVal = excelRound((psVal * iva) / 100.0, 2);
  const oiVal = excelRound((psVal * otrosImp) / 100.0, 2);
  const precioFinal = excelRound(psVal + ivaVal + oiVal, 2);

  const unitCurr = isUsd ? 'USD' : 'Bs.F.';
  const currencyWord = isUsd ? 'DÓLARES' : 'Bs.';
  let sonLetras = options?.son_letras || partida?.son_letras;
  if (!sonLetras || sonLetras === 'SON: ( NO DISPONIBLE )') {
    const sonBase = numeroALetras(precioFinal);
    if (sonBase.includes(' CON ')) {
      const [enteroStr, centavosStr] = sonBase.split(' CON ');
      sonLetras = `SON: ( ${enteroStr} ${currencyWord} con ${centavosStr} ctms )`;
    } else {
      sonLetras = `SON: ( ${sonBase} ${currencyWord} ctms )`;
    }
  }

  const thin = '1px solid #000000';
  const baseCell = {
    fontFamily: 'Calibri, Arial, sans-serif',
    fontSize: '8.5pt',
    color: '#000000',
    padding: '2px 4px',
    verticalAlign: 'middle',
    boxSizing: 'border-box',
    lineHeight: '1.2',
  };
  const boxedCell = {
    ...baseCell,
    border: thin,
  };

  return (
    <div className="apu-sheet-excel-layout" style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#ffffff', color: '#000000' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: 'Calibri, Arial, sans-serif',
          color: '#000000',
        }}
      >
        {/* Proporciones exactas de las columnas B..H de build_apu_sheet (export_utils.py) */}
        <colgroup>
          <col style={{ width: '10.2%' }} />
          <col style={{ width: '38.2%' }} />
          <col style={{ width: '7.2%' }} />
          <col style={{ width: '9.0%' }} />
          <col style={{ width: '7.9%' }} />
          <col style={{ width: '12.5%' }} />
          <col style={{ width: '15.0%' }} />
        </colgroup>
        <tbody>
          {/* Fila 1: Título Principal */}
          <tr style={{ height: '28px' }}>
            <td
              colSpan={7}
              style={{
                ...baseCell,
                fontSize: '16pt',
                fontWeight: 'bold',
                textAlign: 'center',
                paddingBottom: '6px',
              }}
            >
              ANALISIS DE PRECIO UNITARIO
            </td>
          </tr>

          {/* Fila 2: Espaciador superior igual al modelo Excel */}
          <tr style={{ height: '10px' }}>
            <td colSpan={7} style={baseCell} />
          </tr>

          {/* Fila 3: Obra */}
          <tr>
            <td colSpan={7} style={{ ...baseCell, fontSize: '9.5pt', fontWeight: 'bold', textAlign: 'left', verticalAlign: 'top' }}>
              Obra: {obra}
            </td>
          </tr>

          {/* Fila 4: Contratante */}
          <tr>
            <td colSpan={7} style={{ ...baseCell, fontSize: '9.5pt', fontWeight: 'bold', textAlign: 'left', verticalAlign: 'top' }}>
              Contratante: {contratante}
            </td>
          </tr>

          {/* Fila 5: Part. No. y Fecha */}
          <tr>
            <td colSpan={3} style={baseCell} />
            <td style={{ ...baseCell, textAlign: 'right' }}>Part. No.:</td>
            <td style={{ ...baseCell, textAlign: 'center' }}>{partNum}</td>
            <td style={{ ...baseCell, textAlign: 'right' }}>Fecha:</td>
            <td style={{ ...baseCell, textAlign: 'center' }}>{fechaStr}</td>
          </tr>

          {/* Filas 6-7: Descripción */}
          <tr>
            <td style={{ ...baseCell, textAlign: 'left', verticalAlign: 'top' }}>Descripción:</td>
            <td
              colSpan={6}
              rowSpan={2}
              style={{
                ...baseCell,
                textAlign: 'justify',
                verticalAlign: 'top',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                minHeight: '28px',
              }}
            >
              {descripcion}
            </td>
          </tr>
          <tr style={{ height: '14px' }}>
            <td style={baseCell} />
          </tr>

          {/* Fila 8: Rendimiento */}
          <tr>
            <td colSpan={5} style={baseCell} />
            <td style={{ ...baseCell, textAlign: 'right' }}>Rendimiento:</td>
            <td style={{ ...baseCell, textAlign: 'center' }}>{fmt6(rendimiento)}</td>
          </tr>

          {/* Fila 9: Código, Unidad, Cantidad */}
          <tr>
            <td style={{ ...baseCell, textAlign: 'left' }}>Código:</td>
            <td colSpan={2} style={{ ...baseCell, textAlign: 'left' }}>{codigo}</td>
            <td style={{ ...baseCell, textAlign: 'right' }}>Unidad:</td>
            <td style={{ ...baseCell, textAlign: 'center' }}>{unidad}</td>
            <td style={{ ...baseCell, textAlign: 'right' }}>Cantidad:</td>
            <td style={{ ...baseCell, textAlign: 'center' }}>{fmt2(cantidad)}</td>
          </tr>

          {/* Fila 10: Separador */}
          <tr style={{ height: '6px' }}>
            <td colSpan={7} style={{ padding: 0 }} />
          </tr>

          {/* SECCIÓN MATERIALES */}
          <tr>
            <td colSpan={7} style={{ ...baseCell, fontSize: '11pt', fontWeight: 'normal', paddingTop: '4px', paddingBottom: '2px' }}>
              MATERIALES
            </td>
          </tr>
          <tr>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>No.</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Descripción</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Und.</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Cant.</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Desp.</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Precio</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Total</td>
          </tr>
          {computedMats.map((m) => (
            <tr key={`mat-${m.no}`}>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{m.no}</td>
              <td style={{ ...boxedCell, textAlign: 'justify', wordBreak: 'break-word' }}>{m.desc}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{m.und}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt4(m.cant)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(m.desp)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(m.precio)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(m.total)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={baseCell} />
            <td
              colSpan={2}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderTop: thin,
                borderRight: thin,
              }}
            >
              Total Materiales:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(totalMat)}</td>
          </tr>

          {/* SECCIÓN EQUIPOS */}
          <tr>
            <td colSpan={7} style={{ ...baseCell, fontSize: '11pt', fontWeight: 'normal', paddingTop: '6px', paddingBottom: '2px' }}>
              EQUIPOS
            </td>
          </tr>
          <tr>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>No.</td>
            <td colSpan={2} style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Descripción</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Cant.</td>
            <td style={{ ...boxedCell, fontSize: '7.5pt', fontWeight: 'bold', textAlign: 'center' }}>Cop/Dep</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Precio</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Total</td>
          </tr>
          {computedEqs.map((e) => (
            <tr key={`eq-${e.no}`} style={{ minHeight: '22px' }}>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{e.no}</td>
              <td colSpan={2} style={{ ...boxedCell, textAlign: 'justify', wordBreak: 'break-word' }}>{e.desc}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(e.cant)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt6(e.deprec)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(e.precio)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(e.total)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={baseCell} />
            <td
              colSpan={2}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderTop: thin,
                borderRight: thin,
              }}
            >
              Total Equipos:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(totalEq)}</td>
          </tr>
          <tr>
            <td colSpan={3} style={baseCell} />
            <td
              colSpan={3}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderRight: thin,
              }}
            >
              Costo Unitarios Equipos:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(cuoEq)}</td>
          </tr>

          {/* SECCIÓN MANO DE OBRA */}
          <tr>
            <td colSpan={7} style={{ ...baseCell, fontSize: '11pt', fontWeight: 'normal', paddingTop: '6px', paddingBottom: '2px' }}>
              MANO DE OBRA
            </td>
          </tr>
          <tr>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>No.</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Descripción</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Cant.</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Jornal</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Bono</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Total Jornal</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>Total Bono</td>
          </tr>
          {computedLabs.map((l) => (
            <tr key={`lab-${l.no}`}>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{l.no}</td>
              <td style={{ ...boxedCell, textAlign: 'justify', wordBreak: 'break-word' }}>{l.desc}</td>
              <td style={{ ...boxedCell, textAlign: 'right' }}>{fmt2(l.cant)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(l.jornal)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(l.bono)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(l.totJornal)}</td>
              <td style={{ ...boxedCell, textAlign: 'center' }}>{fmt2(l.totBono)}</td>
            </tr>
          ))}

          {/* SubTotal Mano de Obra */}
          <tr>
            <td colSpan={2} style={baseCell} />
            <td
              colSpan={3}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderTop: thin,
                borderRight: thin,
              }}
            >
              SubTotal Mano de Obra:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(totalMoJornal)}</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(totalMoBono)}</td>
          </tr>

          {/* Prestaciones Sociales */}
          <tr>
            <td style={baseCell} />
            <td style={{ ...baseCell, fontWeight: 'bold', textAlign: 'right' }}>{fmt2(prestaciones)}</td>
            <td
              colSpan={3}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderRight: thin,
              }}
            >
              Prestaciones Sociales:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(moPs)}</td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(0)}</td>
          </tr>

          {/* Total General Mano de Obra */}
          <tr>
            <td colSpan={2} style={baseCell} />
            <td
              colSpan={4}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderRight: thin,
              }}
            >
              Total General Mano de Obra:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(totalMo)}</td>
          </tr>

          {/* Costo Unitario de Mano de Obra */}
          <tr>
            <td colSpan={2} style={baseCell} />
            <td
              colSpan={4}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderRight: thin,
              }}
            >
              Costo Unitario de Mano de Obra:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(cuoMo)}</td>
          </tr>

          {/* Otros Impuestos (Mano de Obra) */}
          <tr>
            <td colSpan={3} style={baseCell} />
            <td style={{ ...baseCell, fontWeight: 'bold', textAlign: 'right' }}>{fmt2(otrosImp)}</td>
            <td
              colSpan={2}
              style={{
                ...baseCell,
                fontSize: '10pt',
                fontWeight: 'normal',
                textAlign: 'left',
                borderRight: thin,
              }}
            >
              Otros Impuestos:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(otrosMoVal)}</td>
          </tr>

          {/* RESUMEN DE COSTOS (Estructura idéntica a build_apu_sheet) */}
          <tr>
            <td colSpan={3} style={baseCell} />
            <td
              colSpan={3}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderRight: thin,
              }}
            >
              COSTO DIRECTO SUBTOTAL A:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(cdVal)}</td>
          </tr>

          {/* Administración y Gastos Generales */}
          <tr>
            <td style={baseCell} />
            <td style={{ ...baseCell, fontWeight: 'bold', textAlign: 'right' }}>{fmt2(adminGg)}</td>
            <td
              colSpan={4}
              style={{
                ...baseCell,
                fontSize: '10pt',
                fontWeight: 'normal',
                textAlign: 'left',
                borderRight: thin,
              }}
            >
              Administración y Gastos Generales:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(adVal)}</td>
          </tr>

          {/* SUBTOTAL B */}
          <tr>
            <td colSpan={2} style={baseCell} />
            <td
              colSpan={4}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderRight: thin,
              }}
            >
              SUBTOTAL B:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(sbVal)}</td>
          </tr>

          {/* Imprevisto Utilidad + Bloque fusionado B{iu_row}:C{pf_row} para SON: (...) */}
          <tr>
            <td
              colSpan={2}
              rowSpan={8}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'center',
                verticalAlign: 'bottom',
                padding: '4px 6px',
                wordBreak: 'break-word',
              }}
            >
              {sonLetras}
            </td>
            <td style={baseCell} />
            <td style={{ ...baseCell, fontWeight: 'bold', textAlign: 'right' }}>{fmt2(imprevistoUt)}</td>
            <td
              colSpan={2}
              style={{
                ...baseCell,
                fontSize: '10pt',
                fontWeight: 'normal',
                textAlign: 'left',
                borderRight: thin,
              }}
            >
              Imprevisto Utilidad:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(iuVal)}</td>
          </tr>

          {/* SUBTOTAL C */}
          <tr>
            <td
              colSpan={4}
              style={{
                ...baseCell,
                fontWeight: 'bold',
                textAlign: 'right',
                borderRight: thin,
              }}
            >
              SUBTOTAL C:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(scVal)}</td>
          </tr>

          {/* Financiamiento */}
          <tr>
            <td style={baseCell} />
            <td style={{ ...baseCell, fontWeight: 'bold', textAlign: 'right' }}>{fmt2(financiamiento)}</td>
            <td
              colSpan={2}
              style={{
                ...baseCell,
                fontSize: '10pt',
                fontWeight: 'normal',
                textAlign: 'left',
                borderRight: thin,
              }}
            >
              Financiamiento:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(finVal)}</td>
          </tr>

          {/* PRECIO UNITARIO SIN IMPUESTO */}
          <tr>
            <td
              colSpan={4}
              style={{
                ...baseCell,
                fontSize: '10pt',
                fontWeight: 'normal',
                textAlign: 'left',
                borderRight: thin,
              }}
            >
              PRECIO UNITARIO SIN IMPUESTO:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(psVal)}</td>
          </tr>

          {/* Impuesto (I.V.A.) */}
          <tr>
            <td style={baseCell} />
            <td style={{ ...baseCell, fontWeight: 'bold', textAlign: 'right' }}>{fmt2(iva)}</td>
            <td
              colSpan={2}
              style={{
                ...baseCell,
                fontSize: '10pt',
                fontWeight: 'normal',
                textAlign: 'left',
                borderRight: thin,
              }}
            >
              Impuesto (I.V.A.):
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(ivaVal)}</td>
          </tr>

          {/* Otros Impuestos */}
          <tr>
            <td style={baseCell} />
            <td style={{ ...baseCell, fontWeight: 'bold', textAlign: 'right' }}>{fmt2(otrosImp)}</td>
            <td
              colSpan={2}
              style={{
                ...baseCell,
                fontSize: '10pt',
                fontWeight: 'normal',
                textAlign: 'left',
                borderRight: thin,
              }}
            >
              Otros Impuestos:
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(oiVal)}</td>
          </tr>

          {/* Fila separadora fina antes de Precio Unitario Final (pf_row - 1 en Excel) */}
          <tr style={{ height: '5px' }}>
            <td colSpan={5} style={{ padding: 0 }} />
          </tr>

          {/* PRECIO UNITARIO FINAL */}
          <tr>
            <td
              colSpan={4}
              style={{
                ...baseCell,
                fontSize: '10pt',
                fontWeight: 'normal',
                textAlign: 'left',
                borderRight: thin,
              }}
            >
              PRECIO UNITARIO ({unitCurr}):
            </td>
            <td style={{ ...boxedCell, fontWeight: 'bold', textAlign: 'center' }}>{fmt2(precioFinal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function PrintAPULayout({ partida, materiales, equipos, mano_obra, options }) {
  if (!partida) return null;

  return createPortal(
    <div
      id="print-apu-layout"
      className="print-only"
      style={{
        display: 'none',
        backgroundColor: '#fff',
        color: '#000',
        fontFamily: 'Calibri, Arial, sans-serif',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <APUPrintSheet
        partida={partida}
        materiales={materiales}
        equipos={equipos}
        mano_obra={mano_obra}
        options={options}
      />
    </div>,
    document.body
  );
}
