import { IMessageService, IPiBridge, IPathfinderScanner, IMeshRadar } from '../../services/types';
import { MeshMessage, BridgeStatus, BridgePeer, WalkSession, MeshNode } from '../../types';
import { PathfinderActiveState } from '../../services/scanner/pathfinderScanner';

export class FakeMessageService implements IMessageService {
  private messages: MeshMessage[] = [];
  private listeners: Set<() => void> = new Set();
  
  async initMessageStorage(): Promise<void> {
    // No-op for in-memory fake
  }
  
  async getLocalUserCrypto(): Promise<{ publicKeyHex: string; keyPair: CryptoKeyPair }> {
    return {
      publicKeyHex: 'mock_pub_key',
      keyPair: {} as CryptoKeyPair
    };
  }
  
  getPeerPublicKey(peerCallsignOrId: string): string {
    return 'mock_peer_pub_key';
  }
  
  async encryptWithPublicKey(plaintext: string, recipientPublicKeyHex: string): Promise<string> {
    return btoa(`mock_encrypted:${plaintext}`);
  }
  
  async decryptWithKey(encryptedBase64: string, expectedKeyHex: string): Promise<string> {
    try {
      const decoded = atob(encryptedBase64);
      if (decoded.startsWith('mock_encrypted:')) {
        return decoded.replace('mock_encrypted:', '');
      }
    } catch {}
    return 'mock_decrypted';
  }
  
  async sendDirectMessage(peerId: string, content: string): Promise<MeshMessage> {
    const msg: MeshMessage = {
      id: `msg_${Date.now()}`,
      from: 'local_user',
      to: peerId,
      content: btoa(`mock_encrypted:${content}`),
      timestamp: Date.now(),
      ttl: 3,
      signature: 'mock_sig',
      senderId: 'local_user_id',
      senderCallsign: 'LOCAL',
      recipientId: peerId,
      recipientCallsign: 'PEER',
      text: content,
      decryptedText: content,
      status: 'pending',
      isRead: true,
      hopCount: 1,
    };
    this.messages.push(msg);
    this.notify();
    return msg;
  }
  
  async getConversation(peerId: string): Promise<MeshMessage[]> {
    return this.messages.filter(m => m.recipientId === peerId || m.senderId === peerId);
  }
  
  async getUnreadCount(): Promise<number> {
    return this.messages.filter(m => !m.isRead && m.senderId !== 'local_user_id').length;
  }
  
  async markConversationAsRead(peerId: string): Promise<void> {
    let updated = false;
    this.messages.forEach(m => {
      if (m.senderId === peerId && !m.isRead) {
        m.isRead = true;
        updated = true;
      }
    });
    if (updated) this.notify();
  }
  
  async saveIncomingMessage(message: MeshMessage): Promise<boolean> {
    if (this.messages.some(m => m.id === message.id)) return false;
    this.messages.push({ ...message, isRead: false, status: 'delivered' });
    this.notify();
    return true;
  }
  
  subscribeToMessages(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export class FakePiBridge implements IPiBridge {
  private isConnected = true;
  private listeners: Set<(status: BridgeStatus) => void> = new Set();
  
  private status: BridgeStatus = {
    connected: true,
    ipAddress: '192.168.mock.1',
    piBatteryPercent: 100,
    solarVoltage: 14.5,
    solarWatts: 15.0,
    radioModules: ['ble', 'lora_868'],
    uptimeSeconds: 100,
    relayedPacketsCount: 0,
  };

  async discoverBridge(customIp?: string): Promise<{ success: boolean; ip: string; status: BridgeStatus }> {
    return { success: true, ip: customIp || this.status.ipAddress, status: this.status };
  }
  
  async getBridgeStatus(): Promise<BridgeStatus> {
    return this.status;
  }
  
  async getMeshPeersFromBridge(): Promise<BridgePeer[]> {
    return [];
  }
  
  async syncBridgePeersToStore(): Promise<BridgePeer[]> {
    return [];
  }
  
  async executeBridgeCommand(command: string, params?: Record<string, any>): Promise<{ success: boolean; data?: any; error?: string }> {
    return { success: true, data: { mockData: 'executed' } };
  }
  
  async sendViaBridge(packet: { type: string; from: string; to?: string; payload: any }): Promise<{ success: boolean; txId?: string }> {
    this.status.relayedPacketsCount! += 1;
    this.notify();
    return { success: true, txId: 'mock_tx_id' };
  }
  
  async getAsciiMapFromBridge(): Promise<string> {
    return 'Mock ASCII Map';
  }
  
  setCustomBridgeIp(ip: string): void {
    this.status.ipAddress = ip;
  }
  
  getCustomBridgeIp(): string {
    return this.status.ipAddress;
  }
  
  setBridgeAuthToken(token: string): void {}
  getBridgeAuthToken(): string { return 'mock_token'; }

  getClientId(): string { return 'FAKE-CLIENT-ID'; }
  setClientId(id: string): void {}

  async startPairing(ip?: string, clientId?: string): Promise<{ success: boolean; sessionId?: string; devPin?: string; error?: string }> {
    return { success: true, sessionId: 'mock_session_123', devPin: '123456' };
  }

  async confirmPairing(sessionId: string, pin: string, ip?: string, clientId?: string): Promise<{ success: boolean; auth_token?: string; deviceId?: string; error?: string }> {
    return { success: true, auth_token: 'mock_minted_token', deviceId: 'dev_mock_99' };
  }

  async revokeDevice(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }
  
  setMockBridgeMode(enabled: boolean): void {
    this.isConnected = enabled;
    this.status.connected = enabled;
    this.notify();
  }
  
  isMockBridgeMode(): boolean {
    return true;
  }
  
  subscribeBridgeStatus(listener: (status: BridgeStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }
  
  private notify() {
    this.listeners.forEach(cb => cb(this.status));
  }
}

export class FakeMeshRadar implements IMeshRadar {
  public peers: MeshNode[] = [];
  
  async startScan(): Promise<void> {
    // mock scan implementation
  }
  
  async stopScan(): Promise<void> {
    // mock stop implementation
  }
  
  getPeers(): MeshNode[] {
    return this.peers;
  }
}

export class FakePathfinderScanner implements IPathfinderScanner {
  private state: PathfinderActiveState = {
    isRecording: false,
    isPaused: false,
    activeSession: null,
    currentLocation: null,
    totalDistanceMeters: 0,
    elapsedSeconds: 0,
    newWifiCount: 0,
    newBleCount: 0,
    newLoraCount: 0,
    knownRepeatsCount: 0,
    knownBssidsCount: 0,
    knownMacsCount: 0,
    knownLoraIdsCount: 0,
    recentDiscoveries: [],
    isSimulatingWalk: false,
    soundEnabled: false,
    hasWebBluetooth: true,
    hasWebSerial: false,
    isWebBluetoothScanning: false,
  };
  private listeners: Set<(s: PathfinderActiveState) => void> = new Set();
  
  getState(): PathfinderActiveState { return this.state; }
  
  subscribe(listener: (s: PathfinderActiveState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  startWalkSession(customTitle?: string): WalkSession {
    this.state.isRecording = true;
    this.state.activeSession = {
      id: `session_${Date.now()}`,
      title: customTitle || 'Fake Session',
      startedAt: Date.now(),
      endedAt: Date.now(),
      track: [],
      newWifiSpots: [],
      newBluetoothSpots: [],
      newLoraNodes: [],
      totalDistanceMeters: 0,
    };
    this.notify();
    return this.state.activeSession;
  }
  
  async stopAndSaveWalkSession(): Promise<WalkSession | null> {
    this.state.isRecording = false;
    this.notify();
    return this.state.activeSession;
  }
  
  pauseWalkSession(): void {
    this.state.isPaused = true;
    this.notify();
  }
  resumeWalkSession(): void {
    this.state.isPaused = false;
    this.notify();
  }
  toggleSimulatedWalk(enable?: boolean): void {}
  toggleWalkSimulation(enable?: boolean): void {}
  toggleSound(enabled?: boolean): void {}
  
  async logManualDiscovery(type: 'wifi' | 'ble' | 'lora', data: any): Promise<boolean> { return true; }
  async scanRealWebBluetoothDevice(): Promise<boolean> { return true; }
  
  private notify() {
    this.listeners.forEach(cb => cb(this.state));
  }
}
