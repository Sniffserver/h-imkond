import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSafeLocalStorage, setSafeLocalStorage } from '../utils/localStorageValidator';

describe('localStorageValidator', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);

    const mockLocalStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      length: 0,
      key: vi.fn(),
    };

    vi.stubGlobal('window', { localStorage: mockLocalStorage });
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  it('returns fallback value if item does not exist', () => {
    const val = getSafeLocalStorage('non_existent_key', { mode: 'default' });
    expect(val).toEqual({ mode: 'default' });
  });

  it('safely parses valid JSON data from localStorage', () => {
    setSafeLocalStorage('test_user', { name: 'Muru', level: 5 });
    const user = getSafeLocalStorage<{ name: string; level: number }>('test_user', { name: 'Guest', level: 1 });
    expect(user.name).toBe('Muru');
    expect(user.level).toBe(5);
  });

  it('returns fallback if JSON data is corrupted or malformed', () => {
    store['corrupted_key'] = '{ malformed json... }';
    const val = getSafeLocalStorage('corrupted_key', { status: 'fallback' });
    expect(val).toEqual({ status: 'fallback' });
  });

  it('applies custom validator function when supplied', () => {
    setSafeLocalStorage('invalid_schema', { unknownProp: 123 });
    const isUser = (obj: unknown): obj is { name: string } =>
      typeof obj === 'object' && obj !== null && 'name' in obj;

    const val = getSafeLocalStorage('invalid_schema', { name: 'DefaultName' }, isUser);
    expect(val.name).toBe('DefaultName');
  });
});
