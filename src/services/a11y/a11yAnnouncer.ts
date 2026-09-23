/**
 * Accessible Screen Reader Live Announcement Service
 * Delivers dynamic live announcements for assistive technologies (VoiceOver, NVDA, TalkBack)
 * with support for 'polite' and 'assertive' live regions.
 */

export type A11yAnnouncementPriority = 'polite' | 'assertive';

export interface A11yAnnouncement {
  id: string;
  message: string;
  priority: A11yAnnouncementPriority;
  timestamp: number;
}

type AnnounceListener = (announcements: { polite: string; assertive: string }) => void;

class A11yAnnouncerService {
  private politeMessage = '';
  private assertiveMessage = '';
  private listeners: Set<AnnounceListener> = new Set();
  private clearTimeouts: { polite?: any; assertive?: any } = {};

  public announce(message: string, priority: A11yAnnouncementPriority = 'polite'): void {
    if (!message || message.trim() === '') return;

    if (priority === 'assertive') {
      this.assertiveMessage = message;
      if (this.clearTimeouts.assertive) clearTimeout(this.clearTimeouts.assertive);
      this.clearTimeouts.assertive = setTimeout(() => {
        this.assertiveMessage = '';
        this.notify();
      }, 7000);
    } else {
      this.politeMessage = message;
      if (this.clearTimeouts.polite) clearTimeout(this.clearTimeouts.polite);
      this.clearTimeouts.polite = setTimeout(() => {
        this.politeMessage = '';
        this.notify();
      }, 7000);
    }

    this.notify();
  }

  public announcePeerDiscovered(callsign: string, rssi?: number): void {
    const rssiText = rssi !== undefined ? ` Signal strength ${rssi} dBm.` : '';
    this.announce(`New peer node "${callsign}" discovered on local mesh.${rssiText}`, 'polite');
  }

  public announcePeerDisconnected(callsign: string): void {
    this.announce(`Peer node "${callsign}" disconnected from local radio mesh.`, 'polite');
  }

  public announceIncomingMessage(sender: string, textSnippet?: string): void {
    const snippet = textSnippet ? `: "${textSnippet.slice(0, 40)}"` : '';
    this.announce(`New encrypted mesh message from ${sender}${snippet}`, 'polite');
  }

  public announceCrisisAlert(callsign: string, reason: string): void {
    this.announce(`Emergency SOS beacon received from ${callsign}: ${reason}`, 'assertive');
  }

  public announceModalOpen(modalName: string): void {
    this.announce(`${modalName} dialog opened. Press Escape to close.`, 'polite');
  }

  public announceModalClose(modalName: string): void {
    this.announce(`${modalName} dialog closed.`, 'polite');
  }

  public announceActionSuccess(action: string): void {
    this.announce(`Success: ${action}`, 'polite');
  }

  public announceNetworkState(state: string, details?: string): void {
    const detailText = details ? `. ${details}` : '';
    this.announce(`Network status changed to ${state}${detailText}`, 'polite');
  }

  public announceMapStatus(status: string, centerCoords?: [number, number]): void {
    const coordsText = centerCoords ? ` at coordinates ${centerCoords[1].toFixed(4)}N, ${centerCoords[0].toFixed(4)}E` : '';
    this.announce(`Tactical map: ${status}${coordsText}`, 'polite');
  }

  public subscribe(listener: AnnounceListener): () => void {
    this.listeners.add(listener);
    listener({ polite: this.politeMessage, assertive: this.assertiveMessage });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = { polite: this.politeMessage, assertive: this.assertiveMessage };
    this.listeners.forEach((listener) => listener(current));
  }
}

export const a11yAnnouncer = new A11yAnnouncerService();
