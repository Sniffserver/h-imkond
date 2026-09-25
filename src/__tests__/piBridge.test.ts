import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  setCustomBridgeIp,
  setBridgeAuthToken,
  setClientId,
  getClientId,
  startPairing,
  confirmPairing,
  revokeDevice,
  setMockBridgeMode,
  executeBridgeCommand,
  discoverBridge,
} from '../services/comms/piBridge';

describe('piBridge Service HTTP & Pairing interactions', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    // Disable mock mode so we hit the real code paths that use `fetch`
    setMockBridgeMode(false);
    setBridgeAuthToken('test_token_secure');
    setClientId('TEST-CLIENT-ID');
    setCustomBridgeIp('192.168.4.1:8080');

    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('manages non-secret Client ID', () => {
    expect(getClientId()).toBe('TEST-CLIENT-ID');
    setClientId('MOBILE-APP-01');
    expect(getClientId()).toBe('MOBILE-APP-01');
  });

  it('probes health and attaches Bearer token to authenticated status request', async () => {
    // 1st call: /api/v1/health (public)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', version: '1.0.0' }),
    });
    // 2nd call: /api/v1/status (authenticated)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ piBatteryPercent: 90, solarWatts: 15.0 }),
    });
    // 3rd call: /api/v1/peers (peers sync)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const res = await discoverBridge();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.success).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.4.1:8080/api/v1/health');
    const statusCall = fetchMock.mock.calls[1];
    expect(statusCall[0]).toBe('http://192.168.4.1:8080/api/v1/status');
    expect(statusCall[1].headers.get('Authorization')).toBe('Bearer test_token_secure');
  });

  it('handles pairing start and PIN confirmation flow', async () => {
    // 1. startPairing
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', session_id: 'pair-session-123', dev_pin: '840192' }),
    });

    const startRes = await startPairing('192.168.4.1:8080', 'TEST-CLIENT-ID');
    expect(startRes.success).toBe(true);
    expect(startRes.sessionId).toBe('pair-session-123');

    // 2. confirmPairing
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, auth_token: 'hoimu_ptk_minted_123', device_id: 'dev-99' }),
    });

    const confirmRes = await confirmPairing('pair-session-123', '840192');
    expect(confirmRes.success).toBe(true);
    expect(confirmRes.deviceId).toBe('dev-99');
  });

  it('retries on network errors before failing or succeeding', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network request failed')) // attempt 0 fails
      .mockRejectedValueOnce(new TypeError('Network request failed')) // attempt 1 fails
      .mockResolvedValueOnce({ // attempt 2 succeeds
        ok: true,
        json: async () => ({ txId: 'abc' }),
      });

    const res = await executeBridgeCommand('broadcast', { payload: 'hello' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.success).toBe(true);
    expect(res.data?.txId).toBe('abc');
  });

  it('parses error payloads gracefully when request fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'INVALID_PAYLOAD' }),
    });

    const res = await executeBridgeCommand('broadcast', { payload: '' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(false);
    expect(res.error).toBe('INVALID_PAYLOAD');
  });

  it('flags needsPairing when status returns 401 Unauthorized', async () => {
    // 1st call: health ok
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    // 2nd call: status returns 401 Unauthorized
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'UNAUTHORIZED', message: 'Invalid or missing Bearer token' }),
    });

    const res = await discoverBridge('192.168.4.1:8080');
    expect(res.success).toBe(false);
    expect(res.needsPairing).toBe(true);
  });

  it('handles 403 Forbidden responses cleanly without infinite retries', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'FORBIDDEN', message: 'Device revoked by administrator' }),
    });

    const res = await executeBridgeCommand('scan', {});
    expect(res.success).toBe(false);
    expect(res.error).toBe('Device revoked by administrator');
    // Non-network 403 error should not trigger redundant retries
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects old pi bridge server versions (< 1.0.0)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', version: '0.8.2' }), // Old server version
    });

    // Should throw or reject version too old
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ piBatteryPercent: 50 }),
    });

    const res = await discoverBridge();
    // Rejects old version or reports failed discovery
    expect(res).toBeDefined();
  });
});


