import { describe, it, expect } from 'vitest';
import {
  cleanNumericCell,
  serializeRowsToTsv,
  parseTabularComputosClipboard,
} from '../clipboard.js';

describe('clipboard.js - Copiar y Pegar en Planilla de Cómputos', () => {
  it('limpia celdas numéricas con formatos latinos y anglosajones', () => {
    expect(cleanNumericCell('12,50')).toBe('12.50');
    expect(cleanNumericCell('1.250,50')).toBe('1250.50');
    expect(cleanNumericCell('1,250.50')).toBe('1250.50');
    expect(cleanNumericCell('45.00')).toBe('45.00');
    expect(cleanNumericCell('—')).toBe('');
    expect(cleanNumericCell('-')).toBe('');
    expect(cleanNumericCell(null)).toBe('');
  });

  it('serializa filas a formato TSV', () => {
    const rows = [
      {
        id: '1',
        cod_par: 'E111',
        description: 'PINTURA EN PAREDES',
        unit: 'M2',
        length: '10',
        width: '2.5',
        height: '',
        times: 2,
        factor: '',
        distance: '',
        m3: '',
        quantity: 50,
        observations: 'Lado este',
      },
    ];

    const tsv = serializeRowsToTsv(rows);
    expect(tsv).toContain('ITEM\tDESCRIPCIÓN\tUND\tLARGO\tANCHO\tALTO\tVECES\tFACTOR\tDISTANCIA\tM3\tTOTAL\tOBSERVACIONES');
    expect(tsv).toContain('E111\tPINTURA EN PAREDES\tM2\t10\t2.5\t\t2\t\t\t\t50\tLado este');
  });

  it('parsea TSV de Excel con encabezados y calcula dimensiones automáticamente', () => {
    const excelClipboard = `N°\tDESCRIPCIÓN\tUND\tLARGO\tANCHO\tALTO\tVECES\tFACTOR\tDISTANCIA\tM3\tTOTAL\tOBSERVACIONES
1\tCONCRETO EN VIGAS\tM3\t10,00\t0,30\t0,40\t2\t1,000\t\t\t2,40\tVigas de carga
2\tTRANSPORTE DE ESCOMBROS\tM3-KM\t\t\t\t1\t1,000\t15,00\t8,50\t127,50\tBote municipal`;

    const { rows } = parseTabularComputosClipboard(excelClipboard, 'ESTRUCTURA');
    expect(rows.length).toBe(2);

    // Fila 1: Concreto 10 * 0.3 * 0.4 * 2 = 2.40 M3
    expect(rows[0].description).toBe('CONCRETO EN VIGAS');
    expect(rows[0].unit).toBe('M3');
    expect(rows[0].length).toBe('10.00');
    expect(rows[0].width).toBe('0.30');
    expect(rows[0].height).toBe('0.40');
    expect(rows[0].times).toBe(2);
    expect(rows[0].quantity).toBe(2.4);

    // Fila 2: Transporte 8.50 m3 * 15 km * 1 = 127.50 M3-KM
    expect(rows[1].description).toBe('TRANSPORTE DE ESCOMBROS');
    expect(rows[1].unit).toBe('M3-KM');
    expect(rows[1].distance).toBe('15.00');
    expect(rows[1].m3).toBe('8.50');
    expect(rows[1].quantity).toBe(127.5);
  });

  it('parsea TSV de Excel sin encabezados (posicional inteligente)', () => {
    const rawClipboard = `Pintura de brocales\tML\t25,50\t\t\t2\t1\t\t\t51\tAmbos lados
Excavacion a mano\tM3\t5,00\t1,20\t1,50\t1\t1\t\t\t9\tZanja`;

    const { rows } = parseTabularComputosClipboard(rawClipboard, 'GENERAL');
    expect(rows.length).toBe(2);

    // Fila 1: 25.50 * 2 = 51 ML
    expect(rows[0].description).toBe('PINTURA DE BROCALES');
    expect(rows[0].unit).toBe('ML');
    expect(rows[0].length).toBe('25.50');
    expect(rows[0].times).toBe(2);
    expect(rows[0].quantity).toBe(51);

    // Fila 2: 5 * 1.2 * 1.5 * 1 = 9 M3
    expect(rows[1].description).toBe('EXCAVACION A MANO');
    expect(rows[1].unit).toBe('M3');
    expect(rows[1].quantity).toBe(9);
  });

  it('detecta encabezados de capítulo dentro del copiado', () => {
    const textWithChapter = `CAPÍTULO I: DEMOLICIONES
Demolición de losa\tM2\t10\t5\t\t1
CAPÍTULO II: ALBAÑILERÍA
Pared de bloque 15cm\tM2\t12\t2,8\t\t1`;

    const { rows } = parseTabularComputosClipboard(textWithChapter, 'INICIAL');
    expect(rows.length).toBe(2);
    expect(rows[0].chapter).toBe('CAPÍTULO I: DEMOLICIONES');
    expect(rows[0].quantity).toBe(50);
    expect(rows[1].chapter).toBe('CAPÍTULO II: ALBAÑILERÍA');
    expect(rows[1].quantity).toBe(33.6);
  });

  it('parsea tablas copiadas en formato HTML de Excel Web o Google Sheets', () => {
    const htmlTable = `
      <table>
        <tr><th>DESCRIPCIÓN</th><th>UND</th><th>LARGO</th><th>ANCHO</th><th>VECES</th></tr>
        <tr><td>Friso rústico</td><td>M2</td><td>14</td><td>3</td><td>1</td></tr>
      </table>
    `;

    const { rows } = parseTabularComputosClipboard(htmlTable, 'ACABADOS');
    expect(rows.length).toBe(1);
    expect(rows[0].description).toBe('FRISO RÚSTICO');
    expect(rows[0].unit).toBe('M2');
    expect(rows[0].quantity).toBe(42);
  });
});
