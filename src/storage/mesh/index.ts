/**
 * Storage Domain: mesh
 * 
 * Aggregates:
 * - inbox: received packets and messages
 * - outbox: pending and delivered outbound packets
 * - peers: peer records, cryptographic keys, route metrics
 * - packets: deduplication cache and raw wire frames
 * - events: topology, link state, and sync events
 */

export * from '../inbox';
export * from '../outbox';
export * from '../peers';
export * from '../packets';
export * from './events';
