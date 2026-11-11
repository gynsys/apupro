// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PartidaMedicionModal from '../PartidaMedicionModal.jsx';
import { getPartidaDocumentacion } from '../../../data/partidaDocumentacion.js';

afterEach(cleanup);

const item = {
  CodPar: 'E333308125',
  CovPar: 'E333308125',
  Descri: 'LOSA MACIZA, e = 8 cm CON CONCRETO Fc 250 kgf/cm2 A LOS 28 DIAS.',
  UniPar: 'm2',
};

describe('documentación de partida', () => {
  it('hereda la ficha del subcapítulo E33', () => {
    const doc = getPartidaDocumentacion(item);
    expect(doc).toBeTruthy();
    expect(doc.inheritedFrom).toBe('E33');
    expect(doc.title).toBe('Superestructura de concreto');
  });

  it('muestra la medición y permite abrir la pestaña de pago', () => {
    render(<PartidaMedicionModal item={item} onClose={vi.fn()} />);

    expect(screen.getByText('Medición y pago')).toBeTruthy();
    expect(screen.getByText(/Heredado de E33/)).toBeTruthy();
    expect(screen.getByText('Criterio de medición')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Pago/i }));
    expect(screen.getByText('Forma de pago')).toBeTruthy();
  });

  it('muestra un estado vacío cuando no hay ficha del capítulo', () => {
    render(
      <PartidaMedicionModal
        item={{ CodPar: 'X123', CovPar: 'X123', Descri: 'Sin norma', UniPar: 'un' }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Sin documentación registrada')).toBeTruthy();
  });
});
