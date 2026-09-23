import { HoimuPacket } from '../protocol/types';
import { InboxStore, InboxItem } from '../storage/inbox';

export type DeliveryListener = (packet: HoimuPacket, decryptedPayload?: any) => void;

export class DeliveryManager {
  private listeners = new Set<DeliveryListener>();

  public onDelivery(listener: DeliveryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async deliverToLocalApp(
    packet: HoimuPacket,
    decryptedPayload?: any
  ): Promise<InboxItem> {
    const item = await InboxStore.save(packet, decryptedPayload);
    for (const listener of this.listeners) {
      try {
        listener(packet, decryptedPayload);
      } catch (err) {
        console.error('[DeliveryManager] Listener error:', err);
      }
    }
    return item;
  }
}
