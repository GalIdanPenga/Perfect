// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertCircle, Trash2 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

const baseProps = {
  isOpen: true,
  title: 'Confirm Action',
  icon: AlertCircle,
  message: 'Are you sure?',
  themeColor: '#ef4444',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(<ConfirmDialog {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title when isOpen=true', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Confirm Action')).toBeTruthy();
  });

  it('renders message text', () => {
    render(<ConfirmDialog {...baseProps} message="Are you sure?" />);
    expect(screen.getByText(/Are you sure\?/)).toBeTruthy();
  });

  it('renders default confirm and cancel labels', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders custom confirmLabel and cancelLabel', () => {
    render(<ConfirmDialog {...baseProps} confirmLabel="Delete" cancelLabel="Go Back" />);
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Go Back')).toBeTruthy();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders highlightText in a highlighted span', () => {
    render(<ConfirmDialog {...baseProps} highlightText="my-client" />);
    expect(screen.getByText('my-client')).toBeTruthy();
  });

  it('applies themeColor to confirm button background', () => {
    render(<ConfirmDialog {...baseProps} themeColor="#3b82f6" />);
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.style.backgroundColor).toBe('#3b82f6');
  });

  it('renders icon in title', () => {
    const { container } = render(<ConfirmDialog {...baseProps} icon={Trash2} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('accepts ReactNode as message', () => {
    const customMsg = <div data-testid="custom-msg">Custom Message</div>;
    render(<ConfirmDialog {...baseProps} message={customMsg} />);
    expect(screen.getByTestId('custom-msg')).toBeTruthy();
  });
});
