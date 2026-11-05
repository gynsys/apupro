import { describe, it, expect } from 'vitest';
import {
  LINK_TEMPLATES,
  getRecommendedLinkTemplates,
  computeLinkedQuantity,
  applyReactiveLinks,
} from '../links.js';

describe('módulo de cómputos vinculados (links)', () => {
  it('contiene las plantillas de vinculación típicas de construcción', () => {
    expect(LINK_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(LINK_TEMPLATES.some((t) => t.id === 'bote_escombros')).toBe(true);
    expect(LINK_TEMPLATES.some((t) => t.id === 'friso_2caras')).toBe(true);
  });

  it('recomienda plantilla de bote para partidas de excavación', () => {
    const item = { unit: 'M3', description: 'EXCAVACIÓN DE ZANJAS PARA FUNDACIONES' };
    const recs = getRecommendedLinkTemplates(item);
    expect(recs.some((r) => r.id === 'bote_escombros')).toBe(true);
  });

  it('recomienda plantilla de friso para paredes de bloque', () => {
    const item = { unit: 'M2', description: 'PAREDES DE BLOQUES DE CEMENTO 15CM' };
    const recs = getRecommendedLinkTemplates(item);
    expect(recs.some((r) => r.id === 'friso_2caras')).toBe(true);
  });

  it('calcula la cantidad vinculada con factor de esponjamiento y distancia', () => {
    // 15 m3 excavación * 1.25 esponjamiento * 5 km = 93.75 M3-KM
    const result = computeLinkedQuantity(15, { factor: 1.25, distance: 5 });
    expect(result).toBe(93.75);
  });

  it('calcula la cantidad vinculada con factor de friso a 2 caras', () => {
    // 25 m2 de pared * 2 caras = 50 m2
    const result = computeLinkedQuantity(25, { factor: 2 });
    expect(result).toBe(50);
  });

  it('actualiza reactivamente filas vinculadas cuando cambia la fila origen', () => {
    const sourceItem = { id: 'item-source-1', quantity: 20, unit: 'M3', description: 'EXCAVACION' };
    const linkedItem = {
      id: 'item-linked-1',
      quantity: 18.75,
      unit: 'M3-KM',
      description: 'BOTE DE ESCOMBROS',
      linkedTo: {
        sourceItemId: 'item-source-1',
        factor: 1.25,
        distance: 5.0,
        label: 'Vinculado a Excavación (x1.25 esponjamiento x 5km)',
      },
    };

    // Si la excavación sube a 20 m3: 20 * 1.25 * 5 = 125.00
    const updated = applyReactiveLinks([sourceItem, linkedItem]);
    expect(updated[1].quantity).toBe(125);
  });

  it('rompe el vínculo limpiamente si la fila origen fue eliminada', () => {
    const orphanItem = {
      id: 'item-linked-1',
      quantity: 18.75,
      unit: 'M3-KM',
      linkedTo: { sourceItemId: 'item-deleted' },
    };

    const updated = applyReactiveLinks([orphanItem]);
    expect(updated[0].linkedTo).toBeNull();
    expect(updated[0].quantity).toBe(18.75);
  });
});
