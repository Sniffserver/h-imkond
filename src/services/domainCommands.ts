/**
 * HÕIMU Domain Commands
 * UI calls domain commands -> Local state updates -> Mesh event -> Outbox
 */

import { ResourceItem, MeshNode, Transaction, CalendarEvent, DaoProposal } from '../types';

export interface ResourceCommands {
  create: (item: Partial<ResourceItem>) => Promise<ResourceItem>;
  request: (resourceId: string, message?: string) => Promise<Transaction>;
  complete: (transactionId: string) => Promise<void>;
}

export interface PeerCommands {
  verify: (peerId: string) => Promise<void>;
  message: (peerId: string, text: string) => Promise<void>;
  block: (peerId: string, reason?: string) => Promise<void>;
}

export interface ExchangeCommands {
  propose: (peerId: string, details: any) => Promise<void>;
  accept: (exchangeId: string) => Promise<void>;
  complete: (exchangeId: string) => Promise<void>;
}

export interface EventCommands {
  create: (event: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  join: (eventId: string) => Promise<void>;
}

export interface DomainCommands {
  resource: ResourceCommands;
  peer: PeerCommands;
  exchange: ExchangeCommands;
  event: EventCommands;
}

export function createDomainCommands(context: {
  onAddResource?: (item: any) => void;
  onRequestExchange?: (resource: any) => void;
  onSendMessage?: (recipientId: string, text: string) => void;
  onAddCalendarEvent?: (event: any) => void;
  onToggleRsvp?: (eventId: string) => void;
  addToast?: (title: string, desc?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}): DomainCommands {
  return {
    resource: {
      create: async (item) => {
        context.onAddResource?.(item);
        context.addToast?.('Resource shared', `${item.title || 'Item'} posted to local mesh.`, 'success');
        return item as ResourceItem;
      },
      request: async (resourceId, message) => {
        context.onRequestExchange?.({ id: resourceId, title: 'Requested Resource' });
        context.addToast?.('Request sent', 'Direct mesh request transmitted to owner.', 'info');
        return { id: `tx_${Date.now()}`, resourceId } as Transaction;
      },
      complete: async (transactionId) => {
        context.addToast?.('Exchange marked complete', undefined, 'success');
      },
    },
    peer: {
      verify: async (peerId) => {
        context.addToast?.('Peer verification initiated', `OOB fingerprint check for ${peerId}`, 'info');
      },
      message: async (peerId, text) => {
        context.onSendMessage?.(peerId, text);
      },
      block: async (peerId, reason) => {
        context.addToast?.(`Node ${peerId} blocked`, reason, 'warning');
      },
    },
    exchange: {
      propose: async (peerId, details) => {
        context.addToast?.('Exchange proposed', undefined, 'info');
      },
      accept: async (exchangeId) => {
        context.addToast?.('Exchange accepted', undefined, 'success');
      },
      complete: async (exchangeId) => {
        context.addToast?.('Exchange completed', undefined, 'success');
      },
    },
    event: {
      create: async (event) => {
        context.onAddCalendarEvent?.(event);
        context.addToast?.('Event scheduled', event.title, 'success');
        return event as CalendarEvent;
      },
      join: async (eventId) => {
        context.onToggleRsvp?.(eventId);
      },
    },
  };
}
