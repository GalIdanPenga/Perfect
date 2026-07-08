// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TableModal } from './TableModal';

describe('TableModal', () => {

  it('renders task name in header', () => {
    render(<TableModal taskName="My Task" table={[{ col: 'val' }]} onClose={vi.fn()} />);
    expect(screen.getByText('My Task')).toBeTruthy();
  });

  it('renders "Task Result" title', () => {
    render(<TableModal taskName="T" table={[{ col: 'val' }]} onClose={vi.fn()} />);
    expect(screen.getByText('Task Result')).toBeTruthy();
  });

  it('renders via portal into document.body', () => {
    render(<TableModal taskName="T" table={[{ a: 1 }]} onClose={vi.fn()} />);
    expect(document.body.querySelector('[class*="fixed"]')).toBeTruthy();
  });

  it('shows row and column counts in footer', () => {
    render(<TableModal taskName="T" table={[{ a: 1, b: 2 }, { a: 3, b: 4 }]} onClose={vi.fn()} />);
    expect(screen.getByText('Rows')).toBeTruthy();
    expect(screen.getByText('Columns')).toBeTruthy();
    // Both row count and column count equal 2 in this table
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
  });

  it('calls onClose when Close button clicked after animation', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      render(<TableModal taskName="T" table={[{ a: 1 }]} onClose={onClose} />);
      fireEvent.click(screen.getAllByText('Close')[0]);
      act(() => { vi.advanceTimersByTime(200); });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.runAllTimers();
    }
  });

  it('calls onClose when backdrop clicked after animation', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { container } = render(<TableModal taskName="T" table={[{ a: 1 }]} onClose={onClose} />);
      const backdrop = container.ownerDocument.querySelector('.fixed.inset-0') as HTMLElement;
      fireEvent.click(backdrop!);
      act(() => { vi.advanceTimersByTime(200); });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.runAllTimers();
    }
  });

  it('renders null value as italic null text', () => {
    render(<TableModal taskName="T" table={[{ field: null }]} onClose={vi.fn()} />);
    expect(screen.getByText('null')).toBeTruthy();
  });

  it('renders true boolean value', () => {
    render(<TableModal taskName="T" table={[{ ok: true }]} onClose={vi.fn()} />);
    expect(screen.getByText('true')).toBeTruthy();
  });

  it('renders false boolean value', () => {
    render(<TableModal taskName="T" table={[{ ok: false }]} onClose={vi.fn()} />);
    expect(screen.getByText('false')).toBeTruthy();
  });

  it('renders number value with locale formatting', () => {
    render(<TableModal taskName="T" table={[{ count: 42 }]} onClose={vi.fn()} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders string value', () => {
    render(<TableModal taskName="T" table={[{ name: 'Alice' }]} onClose={vi.fn()} />);
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('renders nested object with key → value', () => {
    render(<TableModal taskName="T" table={[{ meta: { score: 99 } }]} onClose={vi.fn()} />);
    expect(screen.getByText('score')).toBeTruthy();
    expect(screen.getByText('99')).toBeTruthy();
  });

  it('renders array items with index', () => {
    render(<TableModal taskName="T" table={[{ items: ['x', 'y'] }]} onClose={vi.fn()} />);
    expect(screen.getByText('0:')).toBeTruthy();
    expect(screen.getByText('x')).toBeTruthy();
  });

  it('renders column headers', () => {
    render(<TableModal taskName="T" table={[{ name: 'Alice', age: 30 }]} onClose={vi.fn()} />);
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('age')).toBeTruthy();
  });

  it('renders all rows', () => {
    render(<TableModal taskName="T" table={[{ v: 'row1' }, { v: 'row2' }]} onClose={vi.fn()} />);
    expect(screen.getByText('row1')).toBeTruthy();
    expect(screen.getByText('row2')).toBeTruthy();
  });
});
