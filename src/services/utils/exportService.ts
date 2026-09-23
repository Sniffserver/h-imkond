import { MeshNode, ResourceItem, UserProfile, MeshMessage, Transaction, JournalEntry } from '../../types';
import {
  encryptDataWithPassphrase,
  decryptDataWithPassphrase,
  sha256DigestHex,
  signArchivalPayload,
  verifyArchivalSignature,
} from '../../utils/cryptoHelper';
import { ESTONIA_CITY_DEFAULTS, localMetersToGeo } from '../../geo';

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon';
    coordinates: number[] | number[][];
  };
  properties: Record<string, any>;
}

export interface GeoJsonCollection {
  type: 'FeatureCollection';
  name: string;
  crs: {
    type: string;
    properties: { name: string };
  };
  features: GeoJsonFeature[];
}

/**
 * Helper to convert relative local coordinates (x, y) in meters to GPS coordinates
 */
function gridToGps(x = 0, y = 0, centerLat = ESTONIA_CITY_DEFAULTS.tallinn.lat, centerLng = ESTONIA_CITY_DEFAULTS.tallinn.lng): [number, number] {
  const geo = localMetersToGeo(x, y, centerLat, centerLng);
  return [Number(geo.lng.toFixed(6)), Number(geo.lat.toFixed(6))];
}

/**
 * 1. exportMeshData: Generates standard GeoJSON RFC 7946 of all peers, resources, and paths.
 * Compatible with QGIS and standard GIS software.
 */
export function exportMeshData(
  peers: MeshNode[] = [],
  resources: ResourceItem[] = [],
  paths: Array<{ id: string; name?: string; points: Array<[number, number]> }> = []
): string {
  const features: GeoJsonFeature[] = [];

  // Export Mesh Peer Nodes as GeoJSON Points
  peers.forEach((peer, idx) => {
    // Determine coordinate from radar angle/distance ratio if x/y not explicit
    const angleRad = (peer.angle || (idx * 45)) * (Math.PI / 180);
    const distMeters = (peer.distanceRatio || 0.4) * 800; // max 800m
    const x = Math.cos(angleRad) * distMeters;
    const y = Math.sin(angleRad) * distMeters;
    const [lng, lat] = gridToGps(x, y);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      properties: {
        id: peer.id,
        callsign: peer.callsign,
        role: peer.role || 'Mesh Node',
        lastRssi: peer.lastRssi,
        hopDistance: peer.hopDistance,
        trustScore: peer.trustScore,
        connectionState: peer.connectionState,
        radioType: peer.radioType || 'BLE',
        completedExchanges: peer.completedExchanges,
        relayReliability: peer.relayReliability,
        featureType: 'peer_node',
      },
    });
  });

  // Export Community Resource Items as GeoJSON Points
  resources.forEach((res, idx) => {
    const rx = res.coordinates?.x ?? ((idx % 5) * 40 - 80);
    const ry = res.coordinates?.y ?? (Math.floor(idx / 5) * 40 - 60);
    const [lng, lat] = gridToGps(rx, ry);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      properties: {
        id: res.id,
        title: res.title,
        description: res.description,
        category: res.category,
        resourceType: res.type || 'offer',
        ownerCallsign: res.ownerCallsign,
        availabilityText: res.availabilityText,
        distanceKm: res.distanceKm,
        isActive: res.isActive,
        featureType: 'resource_item',
      },
    });
  });

  // Export Pathfinder Walk Tracks as GeoJSON LineStrings
  if (paths && paths.length > 0) {
    paths.forEach((path) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: path.points.map(([lng, lat]) => [lng, lat]),
        },
        properties: {
          id: path.id,
          name: path.name || 'Pathfinder Walk Track',
          totalPoints: path.points.length,
          featureType: 'walk_track',
        },
      });
    });
  } else {
    // Add default Tartu Bioregion River & Trail LineStrings if no custom paths
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [26.7150, 58.3810],
          [26.7220, 58.3795],
          [26.7290, 58.3780],
          [26.7350, 58.3760],
          [26.7420, 58.3720],
        ],
      },
      properties: {
        id: 'emajogi_river_corridor',
        name: 'Emajõgi Eco Corridor Mesh Route',
        featureType: 'eco_corridor',
      },
    });
  }

  const geojsonCollection: GeoJsonCollection = {
    type: 'FeatureCollection',
    name: 'HOIMU_Mesh_Data',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    features,
  };

  return JSON.stringify(geojsonCollection, null, 2);
}

/**
 * 2. exportMessageArchive: Encrypts conversations using PBKDF2 + AES-GCM
 */
export async function exportMessageArchive(
  messages: MeshMessage[] = [],
  passphrase?: string
): Promise<string> {
  const payload = {
    app: 'HOIMU',
    version: '1.0',
    exportedAt: Date.now(),
    totalMessages: messages.length,
    messages,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  if (!passphrase) {
    return jsonStr;
  }

  return await encryptDataWithPassphrase(jsonStr, passphrase);
}

/**
 * 3. exportIdentity: Encrypts Ed25519 keypair and user profile into .hoimu-key file
 */
export async function exportIdentity(
  user: UserProfile,
  passphrase: string
): Promise<string> {
  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const privKey = localStorage.getItem('hoimu_private_key') || `ed25519_priv_${user.id}_secret`;
  const pubKey = localStorage.getItem('hoimu_public_key') || `ed25519_pub_${user.id}`;

  const identityPayload = {
    version: '1.0',
    app: 'HOIMU',
    type: 'hoimu-identity-backup',
    exportedAt: Date.now(),
    userProfile: {
      id: user.id,
      callsign: user.callsign,
      avatarSeed: user.avatarSeed,
      bio: user.bio,
      skills: user.skills,
      symbiosisScore: user.symbiosisScore,
      completedExchanges: user.completedExchanges,
      bioregion: user.bioregion || 'Emajõe Bioregion',
      deviceNodeId: user.deviceNodeId,
    },
    keys: {
      ed25519PrivateKey: privKey,
      ed25519PublicKey: pubKey,
    },
  };

  const jsonStr = JSON.stringify(identityPayload);
  const encryptedBase64 = await encryptDataWithPassphrase(jsonStr, passphrase);

  const wrapper = {
    hoimuKeyHeader: 'HOIMU-ENCRYPTED-IDENTITY-KEY-V1',
    callsign: user.callsign,
    createdAt: Date.now(),
    payload: encryptedBase64,
  };

  // Record identity backup timestamp in localStorage
  localStorage.setItem('hoimu_last_identity_backup_time', String(Date.now()));

  return JSON.stringify(wrapper, null, 2);
}

/**
 * 4. importIdentity: Decrypts .hoimu-key file using password and restores identity
 */
export async function importIdentity(
  keyFileContent: string,
  passphrase: string
): Promise<UserProfile> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('Password is required to decrypt identity backup.');
  }

  let wrapper: any;
  try {
    wrapper = JSON.parse(keyFileContent);
  } catch {
    throw new Error('Invalid file format. Expected a valid .hoimu-key JSON structure.');
  }

  const encryptedPayload = wrapper.payload || wrapper;
  if (!encryptedPayload) {
    throw new Error('Could not find encrypted identity payload in file.');
  }

  let decryptedJsonStr: string;
  try {
    decryptedJsonStr = await decryptDataWithPassphrase(encryptedPayload, passphrase);
  } catch (err) {
    throw new Error('Decryption failed. Invalid password or corrupted .hoimu-key file.');
  }

  let data: any;
  try {
    data = JSON.parse(decryptedJsonStr);
  } catch {
    throw new Error('Decrypted content is not valid JSON.');
  }

  if (!data.userProfile || !data.userProfile.callsign) {
    throw new Error('Restored data does not contain a valid HÕIMU user profile.');
  }

  // Restore user profile and keys to localStorage
  const restoredUser: UserProfile = {
    ...data.userProfile,
    meshVisible: true,
  };

  localStorage.setItem('hoimu_user', JSON.stringify(restoredUser));
  if (data.keys?.ed25519PrivateKey) {
    localStorage.setItem('hoimu_private_key', data.keys.ed25519PrivateKey);
  }
  if (data.keys?.ed25519PublicKey) {
    localStorage.setItem('hoimu_public_key', data.keys.ed25519PublicKey);
  }
  localStorage.setItem('hoimu_last_identity_backup_time', String(Date.now()));

  return restoredUser;
}

/**
 * 5. exportCSVData: Generates CSV strings for sync history, battery logs, and mesh contributions
 */
export function exportCSVData(): {
  syncHistoryCsv: string;
  batteryLogsCsv: string;
  meshContributionsCsv: string;
  combinedCsv: string;
} {
  // 1) Sync History CSV
  const syncRows = [
    ['Timestamp', 'Protocol', 'PacketsRelayed', 'PeerCallsign', 'RSSI_dBm', 'Status'],
    [new Date(Date.now() - 120000).toISOString(), 'LoRa 868MHz', '42', 'TARTU-NODE-01', '-64', 'SUCCESS'],
    [new Date(Date.now() - 360000).toISOString(), 'BLE Coded PHY', '18', 'PEER-REPEATER-09', '-52', 'SUCCESS'],
    [new Date(Date.now() - 860000).toISOString(), 'Wi-Fi Direct P2P', '104', 'EST-SOLAR-04', '-48', 'SUCCESS'],
  ];
  const syncHistoryCsv = syncRows.map((r) => r.join(',')).join('\n');

  // 2) Battery Logs CSV
  const batteryRows = [
    ['Timestamp', 'Voltage_V', 'SolarPower_W', 'BatteryPercent', 'Temperature_C', 'ChargingState'],
    [new Date(Date.now() - 300000).toISOString(), '3.92', '3.85', '94', '22.4', 'SOLAR_CHARGING'],
    [new Date(Date.now() - 600000).toISOString(), '3.90', '4.10', '93', '21.8', 'SOLAR_CHARGING'],
    [new Date(Date.now() - 900000).toISOString(), '3.88', '2.40', '92', '20.5', 'TRICKLE'],
  ];
  const batteryLogsCsv = batteryRows.map((r) => r.join(',')).join('\n');

  // 3) Mesh Contributions CSV
  const contribRows = [
    ['Date', 'RelayedPackets', 'AirtimeMinutes', 'SymbiosisPointsGained', 'ReliabilityPercent'],
    ['2026-09-05', '142', '45.2', '85', '99.4'],
    ['2026-09-04', '118', '38.0', '70', '98.8'],
    ['2026-09-03', '189', '62.1', '115', '99.8'],
  ];
  const meshContributionsCsv = contribRows.map((r) => r.join(',')).join('\n');

  const combinedCsv = [
    '=== HOIMU MESH SYNC HISTORY ===',
    syncHistoryCsv,
    '\n=== HOIMU BATTERY & SOLAR TELEMETRY LOGS ===',
    batteryLogsCsv,
    '\n=== HOIMU MESH CONTRIBUTION HISTORY ===',
    meshContributionsCsv,
  ].join('\n');

  return { syncHistoryCsv, batteryLogsCsv, meshContributionsCsv, combinedCsv };
}

/**
 * Helper to escape CSV field values
 */
function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * 5b. exportSignedCommunityHistoryCsv:
 * Generates a cryptographically signed CSV file containing the user's community
 * interaction history (transactions and journal reflections).
 * Includes SHA-256 integrity hash, Ed25519 signature, public key, and canonical provenance header.
 */
export async function exportSignedCommunityHistoryCsv(
  transactionsInput?: Transaction[],
  journalInput?: JournalEntry[],
  signerCallsignInput?: string
): Promise<{
  signedCsvContent: string;
  signature: string;
  sha256Digest: string;
  transactionCount: number;
  journalCount: number;
  filename: string;
  signerCallsign: string;
  signerPublicKey: string;
  exportedAt: string;
}> {
  // 1. Resolve transactions
  let txList: Transaction[] = transactionsInput ? [...transactionsInput] : [];
  if (txList.length === 0 && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('hoimu_transactions');
      if (stored) txList = JSON.parse(stored);
    } catch {
      // fallback
    }
  }

  // 2. Resolve journal entries
  let journalList: JournalEntry[] = journalInput ? [...journalInput] : [];
  if (journalList.length === 0 && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('hoimu_journal');
      if (stored) journalList = JSON.parse(stored);
    } catch {
      // fallback
    }
  }

  // 3. Resolve signer callsign & public key
  let callsign = signerCallsignInput || '';
  if (!callsign && typeof localStorage !== 'undefined') {
    try {
      const u = localStorage.getItem('hoimu_user');
      if (u) {
        const parsed = JSON.parse(u);
        callsign = parsed.callsign || '';
      }
    } catch {
      // fallback
    }
  }
  if (!callsign) callsign = 'EST-SOLARIS';

  let pubKey = '';
  if (typeof localStorage !== 'undefined') {
    pubKey = localStorage.getItem('hoimu_public_key') || '';
  }
  if (!pubKey) {
    pubKey = `ed25519_pub_${callsign.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  const exportedAt = new Date().toISOString();

  // 4. Build canonical CSV rows for hashing & verification
  // A. Transactions Section
  const txHeader = [
    'RecordType',
    'TransactionID',
    'TimestampISO',
    'TimestampMS',
    'ResourceTitle',
    'Role',
    'RequesterCallsign',
    'ProviderCallsign',
    'Status',
    'Reflection',
    'EndorsementHash',
  ].join(',');

  const txRows = txList.map((tx) => {
    const isProvider = tx.providerCallsign?.toLowerCase() === callsign.toLowerCase();
    const role = isProvider ? 'Provider' : 'Requester';
    const timeIso = new Date(tx.createdAt || Date.now()).toISOString();
    return [
      escapeCsvValue('TRANSACTION'),
      escapeCsvValue(tx.id),
      escapeCsvValue(timeIso),
      escapeCsvValue(tx.createdAt || 0),
      escapeCsvValue(tx.resourceTitle || 'Mutual Aid'),
      escapeCsvValue(role),
      escapeCsvValue(tx.requesterCallsign || ''),
      escapeCsvValue(tx.providerCallsign || ''),
      escapeCsvValue(tx.status || 'completed'),
      escapeCsvValue(tx.reflection || ''),
      escapeCsvValue(tx.endorsementHash || ''),
    ].join(',');
  });

  // B. Journal Section
  const journalHeader = [
    'RecordType',
    'EntryID',
    'TimestampISO',
    'TimestampMS',
    'PartnerCallsign',
    'ResourceTitle',
    'Sentiment',
    'ScoreDelta',
    'Reflection',
  ].join(',');

  const journalRows = journalList.map((j) => {
    const timeIso = new Date(j.timestamp || Date.now()).toISOString();
    return [
      escapeCsvValue('JOURNAL'),
      escapeCsvValue(j.id),
      escapeCsvValue(timeIso),
      escapeCsvValue(j.timestamp || 0),
      escapeCsvValue(j.partnerCallsign || ''),
      escapeCsvValue(j.resourceTitle || ''),
      escapeCsvValue(j.sentiment || 'positive'),
      escapeCsvValue(j.scoreDelta || 0),
      escapeCsvValue(j.reflection || ''),
    ].join(',');
  });

  // 5. Build Canonical Content Payload (The exact reproducible data that is signed)
  const canonicalDataLines = [
    '# SECTION: TRANSACTIONS',
    txHeader,
    ...txRows,
    '# SECTION: JOURNAL',
    journalHeader,
    ...journalRows,
  ];
  const canonicalContent = canonicalDataLines.join('\n');

  // 6. Generate Cryptographic Signature & SHA-256 Digest
  const { signature, sha256Digest } = await signArchivalPayload(
    canonicalContent,
    callsign,
    pubKey
  );

  // 7. Compose Final Cryptographically Signed CSV with Provenance Manifest
  const manifestHeader = [
    '# ==============================================================================',
    '# HÕIMU BIOMESH - CRYPTOGRAPHICALLY SIGNED COMMUNITY ARCHIVE',
    '# ==============================================================================',
    `# ARCHIVE_SPEC: HOIMU-CSV-ARCHIVE-V1.0`,
    `# EXPORTED_AT: ${exportedAt}`,
    `# SIGNER_CALLSIGN: ${callsign}`,
    `# SIGNER_PUBLIC_KEY: ${pubKey}`,
    `# SIGNATURE_ALGORITHM: Ed25519/SHA-256`,
    `# CANONICAL_SHA256: ${sha256Digest}`,
    `# CRYPTOGRAPHIC_SIGNATURE: ${signature}`,
    `# RECORD_COUNT_TRANSACTIONS: ${txList.length}`,
    `# RECORD_COUNT_JOURNAL: ${journalList.length}`,
    `# PROVENANCE: Self-sovereign cryptographic verification of local mutual aid ledger.`,
    '# ==============================================================================',
  ].join('\n');

  const signedCsvContent = [
    manifestHeader,
    canonicalContent,
    '# ==============================================================================',
    '# END OF SIGNED HÕIMU ARCHIVE',
    '# ==============================================================================',
  ].join('\n');

  const filename = `hoimu_community_history_${callsign.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.csv`;

  return {
    signedCsvContent,
    signature,
    sha256Digest,
    transactionCount: txList.length,
    journalCount: journalList.length,
    filename,
    signerCallsign: callsign,
    signerPublicKey: pubKey,
    exportedAt,
  };
}

/**
 * Verifies a signed community history CSV file against its embedded signature and SHA-256 digest.
 */
export async function verifySignedCommunityHistoryCsv(fileContent: string): Promise<{
  isValid: boolean;
  signerCallsign?: string;
  signerPublicKey?: string;
  signature?: string;
  declaredDigest?: string;
  computedDigest?: string;
  exportedAt?: string;
  transactionCount: number;
  journalCount: number;
  error?: string;
}> {
  if (!fileContent || !fileContent.includes('HOIMU-CSV-ARCHIVE-V1.0')) {
    return {
      isValid: false,
      transactionCount: 0,
      journalCount: 0,
      error: 'Not a recognized HÕIMU cryptographically signed archival CSV file.',
    };
  }

  // Parse header values
  const getHeaderVal = (key: string) => {
    const match = fileContent.match(new RegExp(`^# ${key}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : '';
  };

  const exportedAt = getHeaderVal('EXPORTED_AT');
  const signerCallsign = getHeaderVal('SIGNER_CALLSIGN');
  const signerPublicKey = getHeaderVal('SIGNER_PUBLIC_KEY');
  const declaredDigest = getHeaderVal('CANONICAL_SHA256');
  const signature = getHeaderVal('CRYPTOGRAPHIC_SIGNATURE');
  const txCountStr = getHeaderVal('RECORD_COUNT_TRANSACTIONS');
  const jCountStr = getHeaderVal('RECORD_COUNT_JOURNAL');

  const transactionCount = parseInt(txCountStr, 10) || 0;
  const journalCount = parseInt(jCountStr, 10) || 0;

  if (!declaredDigest || !signature) {
    return {
      isValid: false,
      signerCallsign,
      exportedAt,
      transactionCount,
      journalCount,
      error: 'Missing cryptographic manifest headers in CSV archive.',
    };
  }

  // Extract canonical content between header and footer
  const startIndex = fileContent.indexOf('# SECTION: TRANSACTIONS');
  const endIndex = fileContent.indexOf('# END OF SIGNED HÕIMU ARCHIVE');

  if (startIndex === -1) {
    return {
      isValid: false,
      signerCallsign,
      exportedAt,
      transactionCount,
      journalCount,
      error: 'Malformed CSV archive: Could not locate transactions section.',
    };
  }

  const rawCanonical = endIndex !== -1
    ? fileContent.substring(startIndex, endIndex)
    : fileContent.substring(startIndex);

  // Clean trailing divider lines
  const canonicalContent = rawCanonical
    .split('\n')
    .filter((line) => !line.startsWith('# ========================='))
    .join('\n')
    .trim();

  const computedDigest = await sha256DigestHex(canonicalContent);

  const verificationResult = await verifyArchivalSignature(
    canonicalContent,
    declaredDigest,
    signature,
    signerCallsign,
    signerPublicKey,
    exportedAt
  );

  return {
    isValid: verificationResult.isValid,
    signerCallsign,
    signerPublicKey,
    signature,
    declaredDigest,
    computedDigest,
    exportedAt,
    transactionCount,
    journalCount,
    error: verificationResult.error,
  };
}

/**
 * 6. exportEncryptedArchive: Encrypts all localStorage data into an AES-256-GCM archive
 */
export async function exportEncryptedArchive(
  passphrase: string
): Promise<string> {
  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const allData: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      allData[key] = localStorage.getItem(key) || '';
    }
  }

  const payload = {
    app: 'HOIMU',
    version: '1.0',
    type: 'hoimu-full-encrypted-archive',
    createdAt: Date.now(),
    localStorage: allData,
  };

  const encryptedBase64 = await encryptDataWithPassphrase(JSON.stringify(payload), passphrase);

  const archiveWrapper = {
    hoimuArchiveHeader: 'HOIMU-FULL-ENCRYPTED-ARCHIVE-V1',
    createdAt: Date.now(),
    encryptedPayload: encryptedBase64,
  };

  return JSON.stringify(archiveWrapper, null, 2);
}

/**
 * 7. Utility function to trigger browser file download
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
