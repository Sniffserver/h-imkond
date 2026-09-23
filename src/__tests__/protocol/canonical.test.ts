import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalizeToBytes } from '../../protocol/canonical';

describe('Canonical JSON RFC 8785 Serialization', () => {
  it('serializes keys in deterministic sorted order', () => {
    const objA = { z: 1, a: 2, m: 3 };
    const objB = { m: 3, z: 1, a: 2 };
    expect(canonicalize(objA)).toBe('{"a":2,"m":3,"z":1}');
    expect(canonicalize(objA)).toBe(canonicalize(objB));
  });

  it('handles nested objects and arrays deterministically', () => {
    const nested = {
      user: {
        name: 'Tallinn',
        id: 42,
      },
      tags: ['radio', 'lora'],
    };
    expect(canonicalize(nested)).toBe('{"tags":["radio","lora"],"user":{"id":42,"name":"Tallinn"}}');
  });

  it('omits undefined properties', () => {
    const withUndef = { a: 1, b: undefined };
    expect(canonicalize(withUndef)).toBe('{"a":1}');
  });

  it('encodes to deterministic UTF-8 bytes', () => {
    const bytes = canonicalizeToBytes({ text: 'HÕIMU' });
    expect(ArrayBuffer.isView(bytes)).toBe(true);
    expect(new TextDecoder().decode(bytes)).toBe('{"text":"HÕIMU"}');
  });
});
