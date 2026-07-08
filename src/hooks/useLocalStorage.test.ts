// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  it('returns initialValue when key is not in storage', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('returns stored value when key exists', () => {
    localStorage.setItem('key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('key', 'default'));
    expect(result.current[0]).toBe('stored');
  });

  it('setter updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('key', ''));
    act(() => result.current[1]('new-value'));
    expect(result.current[0]).toBe('new-value');
    expect(JSON.parse(localStorage.getItem('key')!)).toBe('new-value');
  });

  it('setter with null removes from localStorage and resets to initialValue', () => {
    localStorage.setItem('key', JSON.stringify('existing'));
    const { result } = renderHook(() => useLocalStorage('key', 'default'));
    act(() => result.current[1](null));
    expect(result.current[0]).toBe('default');
    expect(localStorage.getItem('key')).toBeNull();
  });

  it('works with null initialValue', () => {
    const { result } = renderHook(() => useLocalStorage<string | null>('key', null));
    expect(result.current[0]).toBeNull();
  });

  it('null setter on null-typed hook removes key', () => {
    localStorage.setItem('key', JSON.stringify('session-123'));
    const { result } = renderHook(() => useLocalStorage<string | null>('key', null));
    expect(result.current[0]).toBe('session-123');
    act(() => result.current[1](null));
    expect(result.current[0]).toBeNull();
    expect(localStorage.getItem('key')).toBeNull();
  });

  it('handles object values', () => {
    const { result } = renderHook(() => useLocalStorage<{ a: number }>('key', { a: 0 }));
    act(() => result.current[1]({ a: 42 }));
    expect(result.current[0]).toEqual({ a: 42 });
    expect(JSON.parse(localStorage.getItem('key')!)).toEqual({ a: 42 });
  });

  it('handles corrupt localStorage value gracefully', () => {
    localStorage.setItem('key', 'not-valid-json{{{');
    const { result } = renderHook(() => useLocalStorage('key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('different keys are independent', () => {
    const { result: a } = renderHook(() => useLocalStorage('keyA', 'a'));
    const { result: b } = renderHook(() => useLocalStorage('keyB', 'b'));
    act(() => a.current[1]('updated-a'));
    expect(a.current[0]).toBe('updated-a');
    expect(b.current[0]).toBe('b');
  });
});
