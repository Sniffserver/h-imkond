import { HoimuPacket } from '../protocol/types';
import { MAX_TTL } from '../protocol/constants';

export function validateAndProcessTTL(packet: HoimuPacket): { shouldForward: boolean; newTTL: number; newHopCount: number } {
  const currentTTL = packet.header.ttl;
  const currentHop = packet.header.hopCount || 0;

  if (currentTTL <= 1) {
    return { shouldForward: false, newTTL: 0, newHopCount: currentHop + 1 };
  }

  const nextTTL = Math.min(currentTTL - 1, MAX_TTL);
  return {
    shouldForward: true,
    newTTL: nextTTL,
    newHopCount: currentHop + 1,
  };
}
