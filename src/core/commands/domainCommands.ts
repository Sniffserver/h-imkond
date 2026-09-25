/**
 * HÕIMU Domain Commands (Requirement 8)
 * 
 * Replaces ad-hoc handler spaghetti with clean, transactional domain commands:
 *   resource.create(), resource.request(), resource.complete()
 *   peer.verify(), peer.message(), peer.block()
 *   exchange.propose(), exchange.accept(), exchange.complete()
 *   event.create(), event.join(), event.rsvp()
 *   governance.propose(), governance.vote()
 * 
 * Pipeline flow:
 *   UI -> Command -> Local State Update -> Event Log / Mesh Sync
 */

import {
  ResourceItem,
  MeshNode,
  Transaction,
  CalendarEvent,
  DaoProposal,
  SkillExchangeItem,
  TrustEndorsement,
} from '../../types';

export interface ResourceCommands {
  create: (data: Partial<ResourceItem>) => Promise<ResourceItem>;
  request: (resourceId: string, message?: string) => Promise<void>;
  complete: (resourceId: string, transactionId?: string) => Promise<void>;
  reflect: (resourceId: string, text: string, sentiment?: any) => Promise<void>;
}

export interface PeerCommands {
  verify: (peerId: string, pinOrKey?: string) => Promise<boolean>;
  message: (peerId: string, content: string) => Promise<void>;
  block: (peerId: string) => Promise<void>;
  unblock: (peerId: string) => Promise<void>;
  endorse: (peerId: string, category: string, comment?: string) => Promise<void>;
}

export interface ExchangeCommands {
  propose: (data: Partial<Transaction>) => Promise<Transaction>;
  accept: (transactionId: string) => Promise<void>;
  complete: (transactionId: string, feedback?: string) => Promise<void>;
  endorse: (transactionId: string, peerId: string) => Promise<void>;
}

export interface EventCommands {
  create: (data: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  join: (eventId: string) => Promise<void>;
  rsvp: (eventId: string, attending: boolean) => Promise<void>;
}

export interface GovernanceCommands {
  propose: (data: Partial<DaoProposal>) => Promise<DaoProposal>;
  vote: (proposalId: string, choice: 'yes' | 'no' | 'abstain', votesCount?: number) => Promise<void>;
}

export interface DomainCommands {
  resource: ResourceCommands;
  peer: PeerCommands;
  exchange: ExchangeCommands;
  event: EventCommands;
  governance: GovernanceCommands;
}

export interface CreateDomainCommandsOptions {
  // Resource callbacks
  onQuickAddResource: (item: Partial<ResourceItem>) => ResourceItem | void;
  onRequestExchange?: (resource: ResourceItem, note?: string) => void;
  onSaveReflection?: (resource: ResourceItem, text: string, sentiment?: any) => void;
  getResources?: () => ResourceItem[];

  // Peer callbacks
  onSendMessage: (receiverId: string, content: string) => void;
  onBlockPeer?: (peerId: string) => void;
  onUnblockPeer?: (peerId: string) => void;
  onVerifyPeer?: (peerId: string, pin?: string) => boolean | Promise<boolean>;
  onEndorsePeer?: (peerId: string, category: string, comment?: string) => void;

  // Exchange callbacks
  onEndorseTransaction?: (txId: string, note: string) => void;

  // Event callbacks
  onAddCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => CalendarEvent | void;
  onToggleRsvp: (eventId: string) => void;

  // Governance callbacks
  onCreateProposal: (proposal: Omit<DaoProposal, 'id' | 'votesYes' | 'votesNo' | 'votesAbstain' | 'status'>) => DaoProposal | void;
  onVoteProposal: (proposalId: string, vote: 'yes' | 'no' | 'abstain') => void;
}

export function createDomainCommands(options: CreateDomainCommandsOptions): DomainCommands {
  return {
    resource: {
      create: async (data: Partial<ResourceItem>): Promise<ResourceItem> => {
        const result = options.onQuickAddResource(data);
        if (result && typeof result === 'object') return result;
        return {
          id: `res-${Date.now()}`,
          title: data.title || 'Untitled Resource',
          category: data.category || 'tool',
          description: data.description || '',
          ownerId: data.ownerId || 'ME',
          ownerCallsign: data.ownerCallsign || 'TAL-01',
          distanceKm: data.distanceKm || 0.5,
          createdAt: data.createdAt || Date.now(),
          isActive: data.isActive ?? true,
          availabilityText: data.availabilityText || 'Available upon request',
          avatarSeed: data.avatarSeed || 'res-avatar',
          ...data,
        } as ResourceItem;
      },

      request: async (resourceId: string, message?: string): Promise<void> => {
        const resources = options.getResources ? options.getResources() : [];
        const found = resources.find((r) => r.id === resourceId);
        if (found && options.onRequestExchange) {
          options.onRequestExchange(found, message);
        }
      },

      complete: async (resourceId: string, transactionId?: string): Promise<void> => {
        if (transactionId && options.onEndorseTransaction) {
          options.onEndorseTransaction(transactionId, 'Resource exchange successfully completed.');
        }
      },

      reflect: async (resourceId: string, text: string, sentiment?: any): Promise<void> => {
        const resources = options.getResources ? options.getResources() : [];
        const found = resources.find((r) => r.id === resourceId);
        if (found && options.onSaveReflection) {
          options.onSaveReflection(found, text, sentiment);
        }
      },
    },

    peer: {
      verify: async (peerId: string, pinOrKey?: string): Promise<boolean> => {
        if (options.onVerifyPeer) {
          return await options.onVerifyPeer(peerId, pinOrKey);
        }
        return true;
      },

      message: async (peerId: string, content: string): Promise<void> => {
        options.onSendMessage(peerId, content);
      },

      block: async (peerId: string): Promise<void> => {
        options.onBlockPeer?.(peerId);
      },

      unblock: async (peerId: string): Promise<void> => {
        options.onUnblockPeer?.(peerId);
      },

      endorse: async (peerId: string, category: string, comment?: string): Promise<void> => {
        options.onEndorsePeer?.(peerId, category, comment);
      },
    },

    exchange: {
      propose: async (data: Partial<Transaction>): Promise<Transaction> => {
        const tx: Transaction = {
          id: `tx-${Date.now()}`,
          resourceId: data.resourceId || `res-${Date.now()}`,
          resourceTitle: data.resourceTitle || 'Resource Exchange',
          requesterId: data.requesterId || 'ME',
          requesterCallsign: data.requesterCallsign || 'TAL-01',
          providerId: data.providerId || 'PEER',
          providerCallsign: data.providerCallsign || 'PÄRNU-02',
          status: data.status || 'pending',
          createdAt: data.createdAt || Date.now(),
          ...data,
        };
        return tx;
      },

      accept: async (transactionId: string): Promise<void> => {
        if (options.onEndorseTransaction) {
          options.onEndorseTransaction(transactionId, 'Accepted exchange proposal.');
        }
      },

      complete: async (transactionId: string, feedback?: string): Promise<void> => {
        if (options.onEndorseTransaction) {
          options.onEndorseTransaction(transactionId, feedback || 'Transaction finalized.');
        }
      },

      endorse: async (transactionId: string, peerId: string): Promise<void> => {
        if (options.onEndorseTransaction) {
          options.onEndorseTransaction(transactionId, `Endorsement registered for peer ${peerId}`);
        }
      },
    },

    event: {
      create: async (data: Partial<CalendarEvent>): Promise<CalendarEvent> => {
        const eventInput: Omit<CalendarEvent, 'id'> = {
          title: data.title || 'Community Gathering',
          date: data.date || new Date().toISOString().split('T')[0],
          time: data.time || '18:00',
          location: data.location || 'Local Commons',
          category: data.category || 'Workshop',
          description: data.description || '',
          attendeesCount: data.attendeesCount || 1,
          organizerCallsign: data.organizerCallsign || 'TAL-01',
          isUserAttending: true,
          ...data,
        };
        const result = options.onAddCalendarEvent(eventInput);
        if (result && typeof result === 'object') return result;
        return {
          id: `evt-${Date.now()}`,
          ...eventInput,
        };
      },

      join: async (eventId: string): Promise<void> => {
        options.onToggleRsvp(eventId);
      },

      rsvp: async (eventId: string, _attending: boolean): Promise<void> => {
        options.onToggleRsvp(eventId);
      },
    },

    governance: {
      propose: async (data: Partial<DaoProposal>): Promise<DaoProposal> => {
        const propInput: Omit<DaoProposal, 'id' | 'votesYes' | 'votesNo' | 'votesAbstain' | 'status'> = {
          title: data.title || 'Untitled Proposal',
          description: data.description || '',
          category: data.category || 'Infrastructure',
          authorCallsign: data.authorCallsign || 'TAL-01',
          endsAt: data.endsAt || (Date.now() + 7 * 86400000),
          symbiosisReward: data.symbiosisReward || 10,
          requiredQuorum: data.requiredQuorum || 5,
          ...data,
        };
        const res = options.onCreateProposal(propInput);
        if (res && typeof res === 'object') return res;
        return {
          id: `prop-${Date.now()}`,
          votesYes: 0,
          votesNo: 0,
          votesAbstain: 0,
          status: 'active',
          ...propInput,
        };
      },

      vote: async (proposalId: string, choice: 'yes' | 'no' | 'abstain', _votesCount?: number): Promise<void> => {
        options.onVoteProposal(proposalId, choice);
      },
    },
  };
}
