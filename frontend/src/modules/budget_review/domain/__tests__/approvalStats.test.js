import { describe, it, expect } from 'vitest';
import { computePartidaApprovalStats } from '../approvalStats.js';

const partida = (findings = []) => ({ is_chapter: false, findings });
const finding = (severity = 'CRITICA', finding_status) => ({ severity, finding_status });

describe('computePartidaApprovalStats', () => {
  it('sin partidas devuelve 100% y todo aprobado', () => {
    expect(computePartidaApprovalStats([])).toMatchObject({ total: 0, score: 100, allApproved: true });
    expect(computePartidaApprovalStats(undefined).score).toBe(100);
  });

  it('60 de 100 partidas aprobadas da 60%', () => {
    const items = [
      ...Array.from({ length: 60 }, () => partida()),
      ...Array.from({ length: 40 }, () => partida([finding('MEDIA')])),
    ];
    const stats = computePartidaApprovalStats(items);
    expect(stats).toMatchObject({ total: 100, approved: 60, observed: 40, score: 60, allApproved: false });
  });

  it('varios hallazgos en una partida cuentan una sola partida observada', () => {
    const stats = computePartidaApprovalStats([
      partida([finding('CRITICA'), finding('ALTA'), finding('MEDIA')]),
      partida(),
    ]);
    expect(stats.observed).toBe(1);
    expect(stats.score).toBe(50);
  });

  it('hallazgos corregidos o justificados no penalizan; rechazados y pendientes sí', () => {
    const stats = computePartidaApprovalStats([
      partida([finding('CRITICA', 'CORREGIDO')]),
      partida([finding('ALTA', 'JUSTIFICADO')]),
      partida([finding('ALTA', 'RECHAZADO')]),
      partida([finding('ALTA', 'PENDIENTE')]),
      partida([finding('ALTA')]),
    ]);
    expect(stats.approved).toBe(2);
    expect(stats.observed).toBe(3);
    expect(stats.score).toBe(40);
  });

  it('los hallazgos informativos INFO_MAPREX no cuentan', () => {
    const stats = computePartidaApprovalStats([partida([finding('INFO_MAPREX')])]);
    expect(stats.allApproved).toBe(true);
    expect(stats.score).toBe(100);
  });

  it('los capítulos no se cuentan como partidas', () => {
    const stats = computePartidaApprovalStats([
      { is_chapter: true, findings: [finding('CRITICA')] },
      partida(),
    ]);
    expect(stats).toMatchObject({ total: 1, observed: 0, score: 100 });
  });

  it('redondea a un decimal', () => {
    const stats = computePartidaApprovalStats([partida(), partida(), partida([finding('MEDIA')])]);
    expect(stats.score).toBe(66.7);
  });
});
