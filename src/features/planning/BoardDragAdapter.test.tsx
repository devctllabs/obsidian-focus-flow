import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardDragAdapter } from './BoardDragAdapter';

const items = [
  { id: 'epic-1', label: 'FF-40 First Epic' },
  { id: 'epic-2', label: 'FF-41 Second Epic' },
];

describe('BoardDragAdapter', () => {
  it('does not initialize drag handles when desktop dragging is disabled', () => {
    render(
      <BoardDragAdapter
        enabled={false}
        group="epics"
        items={items}
        listClassName="list"
        onMove={vi.fn()}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );

    expect(screen.queryByRole('button', { name: /Drag/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps DnD details inside the adapter and exposes desktop drag handles', () => {
    render(
      <BoardDragAdapter
        enabled
        group="epics"
        items={items}
        listClassName="list"
        onMove={vi.fn()}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Drag FF-40 First Epic' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Drag FF-41 Second Epic' }),
    ).toBeEnabled();
  });
});
