import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TxBudgetManager, RADIO_PRIORITY } from '../services/mesh/routing/TxBudgetManager';
import { MeshPacket } from '../services/mesh/transport/types';

describe('TxBudgetManager & Operational Priority Queue (Requirements 41 & 42)', () => {
  let budgetManager: TxBudgetManager;

  beforeEach(() => {
    budgetManager = new TxBudgetManager({ region: 'EU868', maxAirtimeMsPerHour: 36000 });
  });

  it('determines packet priorities correctly (SOS=3, ACK=2, NORMAL=1, TELEMETRY=0)', () => {
    const sosPkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'SOS', payload: { type: 'SOS' } };
    const ackPkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'MESSAGE', payload: { type: 'ACK' } };
    const msgPkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'MESSAGE', payload: { text: 'Hello' } };
    const telemPkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'PING', payload: { type: 'telemetry' } };

    expect(budgetManager.getPacketPriority(sosPkt)).toBe(3);
    expect(budgetManager.getPacketPriority(ackPkt)).toBe(2);
    expect(budgetManager.getPacketPriority(msgPkt)).toBe(1);
    expect(budgetManager.getPacketPriority(telemPkt)).toBe(0);
  });

  it('calculates physical airtime accurately using LoRa SF/BW equations', () => {
    const airtimeShort = budgetManager.calculateAirtimeMs(10, 7, 125);
    const airtimeLong = budgetManager.calculateAirtimeMs(100, 7, 125);

    expect(airtimeShort).toBeGreaterThan(0);
    expect(airtimeLong).toBeGreaterThan(airtimeShort);
  });

  it('dequeues in strict priority order (SOS -> ACK -> MESSAGE -> TELEMETRY)', () => {
    const msgPkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'MESSAGE', payload: { text: 'msg' } };
    const sosPkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'SOS', payload: { type: 'SOS' } };
    const ackPkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'MESSAGE', payload: { type: 'ACK' } };

    budgetManager.enqueuePacket(msgPkt);
    budgetManager.enqueuePacket(sosPkt);
    budgetManager.enqueuePacket(ackPkt);

    const first = budgetManager.dequeueNextPacket();
    expect(first?.priority).toBe(3); // SOS

    const second = budgetManager.dequeueNextPacket();
    expect(second?.priority).toBe(2); // ACK

    const third = budgetManager.dequeueNextPacket();
    expect(third?.priority).toBe(1); // MESSAGE
  });

  it('enforces fairness anti-starvation rules to prevent high priority queues from starving lower queues indefinitely', () => {
    const sosPkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'SOS', payload: { type: 'SOS' } };
    const msgPkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'MESSAGE', payload: { text: 'low prio' } };

    // Enqueue 10 SOS packets and 1 normal message packet
    for (let i = 0; i < 10; i++) {
      budgetManager.enqueuePacket(sosPkt);
    }
    budgetManager.enqueuePacket(msgPkt);

    // Dequeue 5 SOS packets (maxConsecutiveHighPriority = 5)
    for (let i = 0; i < 5; i++) {
      const item = budgetManager.dequeueNextPacket();
      expect(item?.priority).toBe(3);
    }

    // 6th dequeue should yield turn to lower priority normal message
    const item6 = budgetManager.dequeueNextPacket();
    expect(item6?.priority).toBe(1);
    expect((item6?.packet.payload as any).text).toBe('low prio');
  });

  it('executes 5-step TX Workflow (reserve -> check policy -> CAD/LBT -> TX -> record actual airtime)', async () => {
    const pkt: MeshPacket = { ttl: 5, hopCount: 0, type: 'MESSAGE', payload: { text: 'Testing 5-step TX workflow' } };
    const txMock = vi.fn().mockResolvedValue(true);

    const result = await budgetManager.executeTxWorkflow(pkt, txMock);

    expect(result.success).toBe(true);
    expect(result.airtimeMs).toBeGreaterThan(0);
    expect(result.budget.region).toBe('EU868');
    expect(txMock).toHaveBeenCalledTimes(1);

    const newBudget = budgetManager.getTxBudget();
    expect(newBudget.airtimeMs).toBeGreaterThan(0);
  });
});
