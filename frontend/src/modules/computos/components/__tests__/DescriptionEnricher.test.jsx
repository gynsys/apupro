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

  it('actualiza la descripción en segundo plano sin abrir cajas que salten la fila y permite deshacer', async () => {
    enrichComputoDescription.mockResolvedValue(aiResult);
    const onApplyDescription = vi.fn();
    render(<DescriptionEnricher item={item} onApplyDescription={onApplyDescription} onApplyCovenin={() => {}} />);

    fireEvent.click(screen.getByRole('button'));
    await screen.findByText('COVENIN + IA');
    expect(enrichComputoDescription).toHaveBeenCalledWith({ description: 'excavacion de zanja', unit: 'M3' });
    expect(onApplyDescription).toHaveBeenCalledWith('it-1', 'EXCAVACION MANUAL EN TIERRA PARA ZANJAS', { silent: true });

    fireEvent.click(screen.getByText('Deshacer'));
    expect(onApplyDescription).toHaveBeenLastCalledWith('it-1', 'excavacion de zanja', { silent: true });
    await waitFor(() => expect(screen.queryByText('COVENIN + IA')).toBeNull());
  });

  it('permite usar una partida oficial COVENIN desde el menú flotante bajo demanda', async () => {
    enrichComputoDescription.mockResolvedValue(aiResult);
    const onApplyCovenin = vi.fn();
    render(<DescriptionEnricher item={item} onApplyDescription={() => {}} onApplyCovenin={onApplyCovenin} />);

    fireEvent.click(screen.getByRole('button'));
    const toggleBtn = await screen.findByText('(2 COVENIN)');
    fireEvent.click(toggleBtn);
    await screen.findByText('Coincidencias COVENIN');
    const useButtons = screen.getAllByText('Usar');
    expect(useButtons).toHaveLength(2);

    fireEvent.click(useButtons[1]);
    expect(onApplyCovenin).toHaveBeenCalledWith('it-1', aiResult.candidates[1]);
  });

  it('permite cerrar el aviso compacto con el botón de cierre', async () => {
    enrichComputoDescription.mockResolvedValue(aiResult);
    const onApplyDescription = vi.fn();
    render(<DescriptionEnricher item={item} onApplyDescription={onApplyDescription} onApplyCovenin={() => {}} />);

    fireEvent.click(screen.getByRole('button'));
    await screen.findByTitle('Cerrar aviso');
    fireEvent.click(screen.getByTitle('Cerrar aviso'));
    expect(screen.queryByText('COVENIN + IA')).toBeNull();
  });
});
