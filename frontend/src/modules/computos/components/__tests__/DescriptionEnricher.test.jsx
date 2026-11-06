// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/computosApi', () => ({
  enrichComputoDescription: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { enrichComputoDescription } from '../../services/computosApi';
import DescriptionEnricher from '../DescriptionEnricher.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const item = { id: 'it-1', description: 'excavacion de zanja', unit: 'M3' };

const aiResult = {
  suggested_description: 'EXCAVACION MANUAL EN TIERRA PARA ZANJAS',
  source: 'covenin_ia',
  confidence: 'alta',
  reasoning: 'Coincide acción y elemento.',
  ai_used: true,
  warnings: [],
  base_candidate: { cod_par: 'A1', cov_par: 'E-311', description: 'EXCAVACION MANUAL', unit: 'M3', score: 0.9 },
  candidates: [
    { cod_par: 'A1', cov_par: 'E-311', description: 'EXCAVACION MANUAL', unit: 'M3', score: 0.9 },
    { cod_par: 'A2', cov_par: 'E-312', description: 'EXCAVACION MECANICA', unit: 'M3', score: 0.6 },
  ],
};

describe('DescriptionEnricher', () => {
  it('no permite analizar descripciones vacías', () => {
    render(
      <DescriptionEnricher item={{ ...item, description: '' }} onApplyDescription={() => {}} onApplyCovenin={() => {}} />
    );
    expect(screen.getByRole('button').disabled).toBe(true);
  });

  it('muestra la sugerencia y solo modifica la partida al aplicar', async () => {
    enrichComputoDescription.mockResolvedValue(aiResult);
    const onApplyDescription = vi.fn();
    render(<DescriptionEnricher item={item} onApplyDescription={onApplyDescription} onApplyCovenin={() => {}} />);

    fireEvent.click(screen.getByRole('button'));
    await screen.findByText('EXCAVACION MANUAL EN TIERRA PARA ZANJAS');
    expect(enrichComputoDescription).toHaveBeenCalledWith({ description: 'excavacion de zanja', unit: 'M3' });
    expect(onApplyDescription).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Aplicar'));
    expect(onApplyDescription).toHaveBeenCalledWith('it-1', 'EXCAVACION MANUAL EN TIERRA PARA ZANJAS');
    await waitFor(() => expect(screen.queryByText('Aplicar')).toBeNull());
  });

  it('permite usar otra partida oficial COVENIN y excluye la base de las alternativas', async () => {
    enrichComputoDescription.mockResolvedValue(aiResult);
    const onApplyCovenin = vi.fn();
    render(<DescriptionEnricher item={item} onApplyDescription={() => {}} onApplyCovenin={onApplyCovenin} />);

    fireEvent.click(screen.getByRole('button'));
    await screen.findByText('Otras coincidencias COVENIN');
    expect(screen.getAllByText('Usar')).toHaveLength(1);

    fireEvent.click(screen.getByText('Usar'));
    expect(onApplyCovenin).toHaveBeenCalledWith('it-1', aiResult.candidates[1]);
  });

  it('descartar cierra la sugerencia sin aplicar cambios', async () => {
    enrichComputoDescription.mockResolvedValue(aiResult);
    const onApplyDescription = vi.fn();
    render(<DescriptionEnricher item={item} onApplyDescription={onApplyDescription} onApplyCovenin={() => {}} />);

    fireEvent.click(screen.getByRole('button'));
    await screen.findByText('Descartar');
    fireEvent.click(screen.getByText('Descartar'));
    expect(screen.queryByText('EXCAVACION MANUAL EN TIERRA PARA ZANJAS')).toBeNull();
    expect(onApplyDescription).not.toHaveBeenCalled();
  });
});
