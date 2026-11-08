// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ComputosSheet from '../ComputosSheet.jsx';

afterEach(cleanup);

const baseProps = {
  descriptionFilter: '',
  expandedPartials: {},
  filteredCapturedItems: [],
  handleAddPartial: () => {},
  handleClearPartials: () => {},
  handleDuplicateRow: () => {},
  handleEnrichItem: () => {},
  handleInsertRowBelow: () => {},
  handleOpenCoveninModal: () => {},
  handleRemoveChapterHeader: () => {},
  handleRemoveItem: () => {},
  handleRemovePartial: () => {},
  handleRenameChapter: () => {},
  handleToggleExpandPartials: () => {},
  handleTogglePartials: () => {},
  handleUpdateItemField: () => {},
  handleUpdatePartialField: () => {},
  setDescriptionFilter: () => {},
};

describe('componentes de la planilla', () => {
  it('renderiza la planilla en modo tabla sin componentes indefinidos', () => {
    render(<ComputosSheet {...baseProps} viewMode="table" />);
    expect(screen.getByPlaceholderText('Filtrar descripción...')).toBeTruthy();
  });

  it('renderiza la planilla en modo cards sin componentes indefinidos', () => {
    render(<ComputosSheet {...baseProps} viewMode="cards" />);
    expect(screen.getByPlaceholderText('Filtrar partida por descripción...')).toBeTruthy();
  });

  it('abre la macro actividad de pared perimetral', () => {
    render(<ComputosSheet {...baseProps} viewMode="table" onAddMacroRows={() => {}} />);
    fireEvent.click(screen.getByText('Incluir pared perimetral'));
    expect(screen.getByText(/Cómputo en cascada/i)).toBeTruthy();
    expect(screen.getByText(/Pared de Bloque de concreto 15 cm/i)).toBeTruthy();
  });
});
