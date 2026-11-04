// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
    expect(screen.getByText('PLANILLA DE CÓMPUTOS MÉTRICOS')).toBeTruthy();
  });

  it('renderiza la planilla en modo cards sin componentes indefinidos', () => {
    render(<ComputosSheet {...baseProps} viewMode="cards" />);
    expect(screen.getByText('PLANILLA DE CÓMPUTOS MÉTRICOS')).toBeTruthy();
  });
});
