// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionActionButton } from './SessionActionButton';

const baseProps = {
  allFlowsFinished: false,
  themeColor: '#0ea5e9',
  onReturn: vi.fn(),
  onStop: vi.fn(),
};

describe('SessionActionButton', () => {
  it('shows Stop while flows are running', () => {
    render(<SessionActionButton {...baseProps} allFlowsFinished={false} />);
    expect(screen.getByText('Stop')).toBeTruthy();
    expect(screen.queryByText('Return to Worker Selection')).toBeNull();
  });

  it('shows Return to Worker Selection when all flows finished', () => {
    render(<SessionActionButton {...baseProps} allFlowsFinished={true} />);
    expect(screen.getByText('Return to Worker Selection')).toBeTruthy();
    expect(screen.queryByText('Stop')).toBeNull();
  });

  it('calls onStop when Stop is clicked', () => {
    const onStop = vi.fn();
    render(<SessionActionButton {...baseProps} allFlowsFinished={false} onStop={onStop} />);
    fireEvent.click(screen.getByText('Stop'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onReturn when Return is clicked', () => {
    const onReturn = vi.fn();
    render(<SessionActionButton {...baseProps} allFlowsFinished={true} onReturn={onReturn} />);
    fireEvent.click(screen.getByText('Return to Worker Selection'));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});
