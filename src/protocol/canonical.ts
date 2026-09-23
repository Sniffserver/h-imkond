/**
 * Deterministic RFC 8785 JSON Canonicalization Module
 * Guarantees identical byte sequences for signatures across heterogeneous runtime environments (Web, Node, Python, C)
 */

export function canonicalize(value: any): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON does not support non-finite numbers');
    }
    return Object.is(value, -0) ? '0' : String(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalize(item));
    return '[' + items.join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const entries: string[] = [];
    for (const key of keys) {
      if (value[key] !== undefined) {
        entries.push(JSON.stringify(key) + ':' + canonicalize(value[key]));
      }
    }
    return '{' + entries.join(',') + '}';
  }
  throw new TypeError(`Cannot canonicalize unsupported type: ${typeof value}`);
}

export function canonicalizeToBytes(value: any): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}
