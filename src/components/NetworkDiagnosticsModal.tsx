import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import {
  MeshNode,
  BatteryManagerStatus,
  MeshChannelTelemetry,
  MeshPacketLog,
  NodeTracerouteHop,
  MeshFrameType,
} from '../types';
import {
  INITIAL_CHANNEL_TELEMETRY,
  INITIAL_PACKET_LOGS,
  calculatePeerDiagnosticDetails,
  calculateTraceroutePath,
  calculateLinkBudget,
  generateDiagnosticReport,
  generateDiagnosticCsvExport,
} from '../utils/networkDiagnosticsHelper';
import {
  Activity,
  Radio,
  Wifi,
  Cpu,
  Zap,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Download,
  Trash2,
  Play,
  Pause,
  Sliders,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
  HardDrive,
  Copy,
  Check,
  X,
  Gauge,
  Signal,
  ArrowUpRight,
  AlertTriangle,
  History,
  FileSpreadsheet,
  Sun,
} from 'lucide-react';

import { CrdtSyncEngine, HoimuLocalCrdtStore } from '../utils/crdtSync';
import { RealtimeSolarGenerationChart } from './RealtimeSolarGenerationChart';
import { MeshHealthOptimizerView } from './MeshHealthOptimizerView';

interface NetworkDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  peers: MeshNode[];
  batteryStatus: BatteryManagerStatus;
  userCallsign: string;
  isNightMode?: boolean;
}

type DiagnosticTab = 'nodes' | 'mesh_health' | 'spectrum' | 'solar' | 'wirelog' | 'dtn' | 'benchmark' | 'crdt';

// Sync History Chart Component
const SyncHistoryChart: React.FC<{ data: number[] }> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 300;
    const height = 120;
    const margin = { top: 10, right: 10, bottom: 20, left: 35 };

    const x = d3.scaleLinear()
      .domain([0, Math.max(9, data.length - 1)])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([-100, -20])
      .range([height - margin.bottom, margin.top]);

    const line = d3.line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    // Axes
    const xAxis = d3.axisBottom(x).ticks(10).tickFormat(() => '');
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .attr('color', '#87A878')
      .call(xAxis);

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .attr('color', '#87A878')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '9px')
      .style('font-family', 'monospace');

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#2A9D8F')
      .attr('stroke-width', 2)
      .attr('d', line);
      
    // Dots
    svg.selectAll('.dot')
      .data(data)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', (_, i) => x(i))
      .attr('cy', (d: any) => y(d))
      .attr('r', 3)
      .attr('fill', '#E9C46A');
      
  }, [data]);

  return (
    <div className="w-full h-[120px] relative">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  );
};

export const NetworkDiagnosticsModal: React.FC<NetworkDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  peers,
  batteryStatus,
  userCallsign,
  isNightMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<DiagnosticTab>('nodes');
  const [searchTerm, setSearchTerm] = useState('');
  const [frameFilter, setFrameFilter] = useState<string>('all');
  const [packetLogs, setPacketLogs] = useState<MeshPacketLog[]>(INITIAL_PACKET_LOGS);
  const [isLiveStreamPaused, setIsLiveStreamPaused] = useState(false);
  const [selectedPeerForTraceroute, setSelectedPeerForTraceroute] = useState<MeshNode | null>(null);
  const [selectedPacketForInspect, setSelectedPacketForInspect] = useState<MeshPacketLog | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [downloadedCsvSuccess, setDownloadedCsvSuccess] = useState(false);

  // Link budget calculator state
  const [calcDistanceM, setCalcDistanceM] = useState<number>(350);
  const [calcFreqMhz, setCalcFreqMhz] = useState<number>(2400);

  // Benchmark / Test state
  const [isTestingMesh, setIsTestingMesh] = useState(false);
  const [testResults, setTestResults] = useState<{
    avgLatencyMs: number;
    jitterMs: number;
    throughputKbps: number;
    packetLossPct: number;
    testedNodesCount: number;
    timestamp: number;
  } | null>(null);

  // Extract last 10 successful sync RSSI values
  const syncRssiHistory = useMemo(() => {
    const syncPackets = packetLogs.filter(p => p.frameType === 'CRDT_SYNC');
    return syncPackets.slice(0, 10).map(p => p.rssi).reverse();
  }, [packetLogs]);

  // Extract successful mesh synchronization packets for the Sync History log table
  const successfulSyncPackets = useMemo(() => {
    return packetLogs
      .filter((p) => p.frameType === 'CRDT_SYNC' && p.crcValid)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [packetLogs]);

  // CRDT Sync state
  const [crdtLogs, setCrdtLogs] = useState<string[]>([
    '[* System] CRDT sünkroniseerimismootor käivitatud.',
    `[* System] LWW-Element-Set replikatsioon valmis kohaliku tunnusega (Peer ID): ${userCallsign}`,
  ]);
  const [crdtImportValue, setCrdtImportValue] = useState('');
  const [crdtSuccess, setCrdtSuccess] = useState<string | null>(null);
  const [crdtError, setCrdtError] = useState<string | null>(null);
  const [isCrdtSyncing, setIsCrdtSyncing] = useState(false);

  // Computed peer diagnostic link details
  const peerDetails = useMemo(() => calculatePeerDiagnosticDetails(peers), [peers]);

  // Live packet stream generator simulation
  useEffect(() => {
    if (!isOpen || isLiveStreamPaused) return;

    const interval = setInterval(() => {
      const randomPeer = peers[Math.floor(Math.random() * peers.length)];
      if (!randomPeer) return;

      const frameTypes: MeshFrameType[] = [
        'BEACON_ADV',
        'DIRECT_MSG',
        'CRDT_SYNC',
        'TELEMETRY',
        'STORE_FORWARD_BUNDLE',
        'ROUTE_REP',
      ];
      const selectedType = frameTypes[Math.floor(Math.random() * frameTypes.length)];

      const newPacket: MeshPacketLog = {
        id: `pkt-${Date.now().toString().slice(-5)}`,
        timestamp: Date.now(),
        frameType: selectedType,
        sourceCallsign: randomPeer.callsign,
        sourceNodeId: `!${randomPeer.id.slice(0, 8)}`,
        destCallsign: selectedType === 'DIRECT_MSG' ? userCallsign : 'BROADCAST',
        destNodeId: selectedType === 'DIRECT_MSG' ? '!local_kestrel' : '!ffffffff',
        hopCount: randomPeer.hopDistance,
        maxHops: 4,
        rssi: randomPeer.lastRssi + Math.floor(Math.random() * 5 - 2),
        snr: Number((Math.max(2, 10 - randomPeer.hopDistance * 2.5 + Math.random() * 2)).toFixed(1)),
        payloadBytes: Math.floor(Math.random() * 160 + 32),
        payloadSummary:
          selectedType === 'BEACON_ADV'
            ? `Periodic BLE Beacon advert from ${randomPeer.callsign}`
            : selectedType === 'DIRECT_MSG'
            ? `P2P Encrypted packet payload (${randomPeer.callsign} -> ${userCallsign})`
            : selectedType === 'CRDT_SYNC'
            ? `CRDT delta state broadcast for decentralized journal/DAO`
            : selectedType === 'STORE_FORWARD_BUNDLE'
            ? `DTN store & forward custodial payload`
            : `RF node telemetry heartbeat`,
        crcValid: true,
        encrypted: selectedType === 'DIRECT_MSG' || selectedType === 'STORE_FORWARD_BUNDLE',
        rawPayloadJson: JSON.stringify({
          src: randomPeer.callsign,
          type: selectedType,
          hop: randomPeer.hopDistance,
          rssi: randomPeer.lastRssi,
          ts: Date.now(),
        }),
      };

      setPacketLogs((prev) => [newPacket, ...prev.slice(0, 49)]);
    }, 4500);

    return () => clearInterval(interval);
  }, [isOpen, isLiveStreamPaused, peers, userCallsign]);

  if (!isOpen) return null;

  // Filtered nodes
  const filteredPeers = peers.filter(
    (p) =>
      p.callsign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.connectionState.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtered packets
  const filteredPackets = packetLogs.filter((pkt) => {
    const matchesFilter = frameFilter === 'all' || pkt.frameType === frameFilter;
    const matchesSearch =
      pkt.sourceCallsign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkt.destCallsign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkt.payloadSummary.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Traceroute calculation for selected peer
  const tracerouteHops: NodeTracerouteHop[] = selectedPeerForTraceroute
    ? calculateTraceroutePath(selectedPeerForTraceroute, peers, userCallsign)
    : [];

  // Link budget calculation
  const calculatedBudget = calculateLinkBudget(calcFreqMhz, calcDistanceM);

  // Run self-diagnostics test
  const handleRunMeshTest = () => {
    setIsTestingMesh(true);
    setTimeout(() => {
      setIsTestingMesh(false);
      const avgRssi = peers.reduce((acc, p) => acc + p.lastRssi, 0) / (peers.length || 1);
      const loss = batteryStatus.isSolarAwareActive ? 3.4 : 1.2;
      setTestResults({
        avgLatencyMs: Math.round(38 + Math.abs(avgRssi + 60) * 0.5),
        jitterMs: Number((4.2 + (batteryStatus.isSolarAwareActive ? 6.1 : 1.8)).toFixed(1)),
        throughputKbps: batteryStatus.isSolarAwareActive ? 48.5 : 194.2,
        packetLossPct: loss,
        testedNodesCount: peers.length,
        timestamp: Date.now(),
      });
    }, 1800);
  };

  // Export report
  const handleExportReport = () => {
    const jsonStr = generateDiagnosticReport(
      peers,
      batteryStatus,
      userCallsign,
      INITIAL_CHANNEL_TELEMETRY,
      packetLogs
    );
    navigator.clipboard.writeText(jsonStr);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  // Download report file
  const handleDownloadReportFile = () => {
    const jsonStr = generateDiagnosticReport(
      peers,
      batteryStatus,
      userCallsign,
      INITIAL_CHANNEL_TELEMETRY,
      packetLogs
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoimu-mesh-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Diagnostic Export (CSV) for signal strength & latency troubleshooting
  const handleDownloadCsvExport = () => {
    const csvStr = generateDiagnosticCsvExport(
      peers,
      batteryStatus,
      userCallsign,
      INITIAL_CHANNEL_TELEMETRY,
      packetLogs
    );
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hoimu-mesh-diagnostic-telemetry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadedCsvSuccess(true);
    setTimeout(() => setDownloadedCsvSuccess(false), 3000);
  };

  // -------------------------------------------------------------
  // CRDT Sync Operations
  // -------------------------------------------------------------
  const getCrdtExportToken = () => {
    try {
      const resourcesLog = HoimuLocalCrdtStore.getLog('resources');
      const messagesLog = HoimuLocalCrdtStore.getLog('messages');
      const payload = {
        resources: resourcesLog,
        messages: messagesLog,
        timestamp: Date.now(),
        peerId: userCallsign,
      };
      return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch (e) {
      return '';
    }
  };

  const handleCrdtImport = () => {
    setCrdtError(null);
    setCrdtSuccess(null);
    if (!crdtImportValue.trim()) {
      setCrdtError('Kopeeri siia teise seadme sünkroonimise token.');
      return;
    }
    try {
      const decodedStr = decodeURIComponent(escape(atob(crdtImportValue.trim())));
      const parsed = JSON.parse(decodedStr);

      if (!parsed.resources && !parsed.messages) {
        throw new Error('Vigane tokeni sisu (andmed puuduvad).');
      }

      const engine = new CrdtSyncEngine(userCallsign);
      
      let mergedResourcesCount = 0;
      let mergedMessagesCount = 0;

      const updatedLogs: string[] = [
        `[* Peer Sync] Alustati sünkroonimist seadmega: ${parsed.peerId || 'Tundmatu Sõlm'}`,
      ];

      // Merge resources
      if (parsed.resources) {
        const localResLog = HoimuLocalCrdtStore.getLog('resources');
        const mergedResLog = engine.mergeLogs(localResLog, parsed.resources);
        HoimuLocalCrdtStore.saveLog('resources', mergedResLog);
        mergedResourcesCount = Object.keys(parsed.resources).length;
        updatedLogs.push(`- Sünkroonitud ${mergedResourcesCount} vahetusressurssi (LWW konfliktide lahendamine edukas).`);
      }

      // Merge messages
      if (parsed.messages) {
        const localMsgLog = HoimuLocalCrdtStore.getLog('messages');
        const mergedMsgLog = engine.mergeLogs(localMsgLog, parsed.messages);
        HoimuLocalCrdtStore.saveLog('messages', mergedMsgLog);
        mergedMessagesCount = Object.keys(parsed.messages).length;
        updatedLogs.push(`- Sünkroonitud ${mergedMessagesCount} sõnumilogi elementi.`);
      }

      updatedLogs.push(`[* Peer Sync] Sünkroonimine seadmega ${parsed.peerId || 'Tundmatu'} lõpetatud edukalt!`);
      setCrdtLogs((prev) => [...prev, ...updatedLogs]);
      setCrdtSuccess('Andmebaasid edukalt ühendatud ja sünkroonitud!');
      setCrdtImportValue('');
      
      // Update last sync timestamp and record packet
      localStorage.setItem('hoimu_last_sync_timestamp', Date.now().toString());
      const importPacket: MeshPacketLog = {
        id: 'pkt-imp-' + Date.now(),
        timestamp: Date.now(),
        frameType: 'CRDT_SYNC',
        sourceCallsign: parsed.peerId || 'External_Peer',
        sourceNodeId: '!peer_' + (parsed.peerId || 'ext').slice(0, 6).toLowerCase(),
        destCallsign: userCallsign || 'Kestrel-7',
        destNodeId: '!usr_kestrel_7',
        hopCount: 1,
        maxHops: 2,
        rssi: -45,
        snr: 10.0,
        payloadBytes: Math.max(96, (crdtImportValue.length * 0.75) | 0),
        payloadSummary: `Direct token CRDT merge: ${mergedResourcesCount} resources, ${mergedMessagesCount} msgs`,
        crcValid: true,
        encrypted: false,
        rawPayloadJson: JSON.stringify({ type: 'crdt_token_sync', items: mergedResourcesCount + mergedMessagesCount }),
      };
      setPacketLogs((prev) => [importPacket, ...prev]);

      // Fire event to refresh listings
      window.dispatchEvent(new Event('hoimu_crdt_sync_completed'));

    } catch (err: any) {
      setCrdtError(`Vigane sünkroniseerimistoken: ${err.message || err}`);
    }
  };

  const handleSimulateCrdtSync = () => {
    setIsCrdtSyncing(true);
    setCrdtError(null);
    setCrdtSuccess(null);

    const simulationLogs = [
      `[Skan] Tuvastati lähedalasuv BLE Mesh sõlm: Salu_Kotkas (RSSI: -54 dBm, direct)`,
      `[P2P] Luuakse koodivaba kasteühendust (BLE 5.0 Ad-hoc)...`,
      `[Sync] Saadi partneri CRDT sünkroniseerimisvektor...`,
    ];

    setTimeout(() => {
      try {
        const engine = new CrdtSyncEngine(userCallsign);

        // Generate remote state containing some newer changes
        const currentResLog = HoimuLocalCrdtStore.getLog('resources');
        
        // Add a simulation edit - update/add a resource item from Salu_Kotkas
        const simulatedResId = 'sim-item-' + Math.floor(Math.random() * 1000);
        const simulatedItem = {
          id: simulatedResId,
          ownerId: 'peer-salu',
          ownerCallsign: 'Salu_Kotkas',
          title: 'Varu-päikesepaneel 50W',
          description: 'Toimiv mobiilne laadimispaneel kriisiolukorras akude laadimiseks.',
          category: 'Energy' as const,
          type: 'offer' as const,
          distanceKm: 1.4,
          createdAt: Date.now(),
          isActive: true,
          availabilityText: 'Saadaval Kesklinna lähedal',
          avatarSeed: 'salu_kotkas_avatar',
        };

        const remoteResLog = {
          [simulatedResId]: {
            id: simulatedResId,
            value: simulatedItem,
            timestamp: Date.now(),
            peerId: 'Salu_Kotkas',
            deleted: false,
          }
        };

        const mergedRes = engine.mergeLogs(currentResLog, remoteResLog);
        HoimuLocalCrdtStore.saveLog('resources', mergedRes);

        simulationLogs.push(`[LWW-Element-Set] Konfliktiotsing: 1 uus element tuvastatud.`);
        simulationLogs.push(`[LWW-Element-Set] Lisatud: "${simulatedItem.title}" autorilt Salu_Kotkas (Võitis: Uuem ajatempel).`);
        simulationLogs.push(`[Sync] Sünkroonimine Salu_Kotkas lõpetatud edukalt!`);
        
        setCrdtLogs((prev) => [...prev, ...simulationLogs]);
        setCrdtSuccess('Simuleeritud ad-hoc sünkroonimine edukas! Uued vahetusressursid on kaardil nähtavad.');
        setIsCrdtSyncing(false);

        // Update last sync timestamp and record packet log
        localStorage.setItem('hoimu_last_sync_timestamp', Date.now().toString());
        const newSyncPacket: MeshPacketLog = {
          id: 'pkt-sim-' + Date.now(),
          timestamp: Date.now(),
          frameType: 'CRDT_SYNC',
          sourceCallsign: 'Salu_Kotkas',
          sourceNodeId: '!salu_99a',
          destCallsign: userCallsign || 'Kestrel-7',
          destNodeId: '!usr_kestrel_7',
          hopCount: 1,
          maxHops: 3,
          rssi: -54,
          snr: 8.5,
          payloadBytes: 348,
          payloadSummary: 'LWW-Element-Set CRDT state delta exchange (Energy resource added)',
          crcValid: true,
          encrypted: false,
          rawPayloadJson: JSON.stringify({
            crdt_delta: 'resources',
            peer: 'Salu_Kotkas',
            item: simulatedItem.title,
            timestamp: Date.now(),
          }),
        };
        setPacketLogs((prev) => [newSyncPacket, ...prev]);

        // Fire event to refresh listings
        window.dispatchEvent(new Event('hoimu_crdt_sync_completed'));
      } catch (e: any) {
        setCrdtError(`Simulatsiooni viga: ${e.message}`);
        setIsCrdtSyncing(false);
      }
    }, 1500);
  };

  const handleCopyCrdtToken = () => {
    const token = getCrdtExportToken();
    navigator.clipboard.writeText(token);
    setCrdtSuccess('Minu sünkroniseerimise token kopeeritud lõikelauale!');
    setTimeout(() => setCrdtSuccess(null), 3000);
  };

  return (
    <div
      id="network-diagnostics-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-colors duration-200 ${
          isNightMode
            ? 'bg-[#182315] border-[#364E30] text-[#F0F5EE]'
            : 'bg-[#FAF6EE] border-[#87A878]/40 text-[#203A2A]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          className={`px-4 sm:px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${
            isNightMode
              ? 'bg-[#121A10] border-[#2A3B26]'
              : 'bg-[#203A2A] text-white border-[#87A878]/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#588157]/40 border border-[#87A878]/50 flex items-center justify-center text-[#E9C46A] shadow-inner">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg sm:text-xl text-white tracking-tight">
                  Võrgudiagnostika & RF Telemeetria
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#87A878]/25 text-[#E9C46A] border border-[#87A878]/40">
                  Zero-Cloud Layer
                </span>
              </div>
              <p className="text-xs text-[#A8BDA5] font-mono mt-0.5">
                Protokoll: HoimuMesh v2.4 · 2.4GHz BLE + Wi-Fi Direct P2P + 868MHz LoRa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCsvExport}
              className="px-3 py-1.5 rounded-xl bg-[#588157] hover:bg-[#466945] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 border border-[#87A878]/50 cursor-pointer"
              title="Laadi alla signaali tugevuse ja latentsuse telemeetria CSV fail võrguühenduse diagnostikaks võrguühenduseta"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${downloadedCsvSuccess ? 'text-[#E9C46A]' : 'text-white'}`} />
              <span>{downloadedCsvSuccess ? 'CSV Eksporditud!' : 'Diagnostic Export (CSV)'}</span>
            </button>

            <button
              type="button"
              onClick={handleRunMeshTest}
              disabled={isTestingMesh}
              className="px-3 py-1.5 rounded-xl bg-[#2A9D8F] hover:bg-[#238276] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Käivita võrgu latentsuse ja paketikao diagnostikatest"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingMesh ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isTestingMesh ? 'Testib võrku...' : 'Käivita võrgutest'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportReport}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Kopeeri täielik diagnostikaraport JSON formaadis lõikelauale"
            >
              {copiedReport ? <Check className="w-3.5 h-3.5 text-[#E9C46A]" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{copiedReport ? 'Kopeeritud!' : 'Kopeeri raport'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadReportFile}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
              title="Laadi alla JSON raport failina"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer ml-1"
              title="Sulge vaade"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Key Metric KPI Bar */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 p-3 sm:px-6 border-b text-xs font-mono transition-colors ${
            isNightMode ? 'bg-[#141E12] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/25'
          }`}
        >
          <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-current/10">
            <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1">
              <Radio className="w-3 h-3 text-[#588157]" />
              Sõlmede arv
            </div>
            <div className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] mt-0.5">
              {peers.length} sõlme
            </div>
            <div className="text-[9px] text-[#588157]">
              {peers.filter((p) => p.isDirect).length} otse · {peers.filter((p) => !p.isDirect).length} relee
            </div>
          </div>

          <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-current/10">
            <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1">
              <Signal className="w-3 h-3 text-[#2A9D8F]" />
              Keskmine RSSI
            </div>
            <div className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] mt-0.5">
              {Math.round(peers.reduce((acc, p) => acc + p.lastRssi, 0) / (peers.length || 1))} dBm
            </div>
            <div className="text-[9px] text-[#2A9D8F]">Link Budget: +28 dB</div>
          </div>

          <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-current/10">
            <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1">
              <Gauge className="w-3 h-3 text-[#E9C46A]" />
              Keskmine latentsus
            </div>
            <div className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] mt-0.5">
              {testResults ? `${testResults.avgLatencyMs} ms` : '~36 ms (RTT)'}
            </div>
            <div className="text-[9px] text-[#E9C46A]">
              Jitter: {testResults ? `${testResults.jitterMs}ms` : '3.8ms'}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-current/10">
            <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#588157]" />
              Paketisaagis (PDR)
            </div>
            <div className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] mt-0.5">
              {testResults ? `${(100 - testResults.packetLossPct).toFixed(1)}%` : '98.2%'}
            </div>
            <div className="text-[9px] text-[#588157]">CRC32 kontroll OK</div>
          </div>

          <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-current/10">
            <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#F4A261]" />
              Eetriaeg (Airtime)
            </div>
            <div className="font-bold text-sm text-[#E76F51] mt-0.5">0.72% / 1.0%</div>
            <div className="text-[9px] text-[#588157]">ISM regulatsioon OK</div>
          </div>

          <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-current/10">
            <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#2A9D8F]" />
              Päikeserežiim
            </div>
            <div className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] mt-0.5">
              {batteryStatus.isSolarAwareActive ? 'Aktiivne (15m)' : 'Täisvõrk (5m)'}
            </div>
            <div className="text-[9px] text-[#87A878]">{batteryStatus.solarHarvestRateW}W tootlikkus</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex items-center gap-1 px-4 sm:px-6 pt-3 pb-2 border-b overflow-x-auto text-xs font-semibold ${
            isNightMode ? 'bg-[#152012] border-[#2A3B26]' : 'bg-[#F0F5EE] border-[#87A878]/30'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('nodes')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'nodes'
                ? 'bg-[#2A9D8F] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Sõlmede maatriks ({peers.length})</span>
          </button>

          <button
            id="tab-btn-mesh-health-optimizer"
            type="button"
            onClick={() => setActiveTab('mesh_health')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'mesh_health'
                ? 'bg-[#2A9D8F] text-white shadow-xs font-bold'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>Võrgu Tervis & Paigutus (Mesh Health)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('spectrum')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'spectrum'
                ? 'bg-[#2A9D8F] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>RF Spekter & Kanalid</span>
          </button>

          <button
            id="tab-btn-solar-diagnostics"
            type="button"
            onClick={() => setActiveTab('solar')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'solar'
                ? 'bg-[#E9C46A] text-[#203A2A] font-bold shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>Päike & Võimsus (Solar Diagnostics)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wirelog')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'wirelog'
                ? 'bg-[#2A9D8F] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pakettivoo inspektor ({packetLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dtn')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'dtn'
                ? 'bg-[#2A9D8F] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>DTN Puhver & Salvestus</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('benchmark')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'benchmark'
                ? 'bg-[#2A9D8F] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Link Budget & Tööriistad</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('crdt')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              activeTab === 'crdt'
                ? 'bg-[#E76F51] text-white shadow-xs'
                : 'text-[#637062] dark:text-[#A8BDA5] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
            <span>P2P CRDT Sünkroonimine</span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* ========================================================================= */}
          {/* TAB: MESH HEALTH & PLACEMENT OPTIMIZER */}
          {/* ========================================================================= */}
          {activeTab === 'mesh_health' && (
            <MeshHealthOptimizerView
              peers={peers}
              batteryStatus={batteryStatus}
              isNightMode={isNightMode}
            />
          )}

          {/* ========================================================================= */}
          {/* TAB 1: SÕLMEDE MAATRIKS (NODE MATRIX & LINK TELEMETRY) */}
          {/* ========================================================================= */}
          {activeTab === 'nodes' && (
            <div className="space-y-4">
              {/* Sync RSSI Chart */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 shadow-xs space-y-2">
                <h4 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#2A9D8F]" />
                  Viimase 10 võrgusünkroonimise signaalitugevus (RSSI)
                </h4>
                {syncRssiHistory.length > 0 ? (
                  <SyncHistoryChart data={syncRssiHistory} />
                ) : (
                  <div className="h-[120px] flex items-center justify-center text-xs text-[#637062] dark:text-[#A8BDA5] font-mono border border-dashed border-[#87A878]/30 rounded-xl">
                    Ootan CRDT_SYNC pakette...
                  </div>
                )}
              </div>

              {/* Search & Filter Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#637062] dark:text-[#A8BDA5]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Otsi hüüdmärgi, MAC-i või ühendusoleku järgi..."
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 focus:outline-none focus:border-[#588157]"
                  />
                </div>

                <div className="text-xs text-[#637062] dark:text-[#A8BDA5] font-mono">
                  Kuvatakse: <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">{filteredPeers.length}</span> / {peers.length} sõlme
                </div>
              </div>

              {/* Node Cards & Details Table */}
              <div className="border border-[#87A878]/30 rounded-2xl overflow-hidden bg-white dark:bg-[#121A10] shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF6EE] dark:bg-[#1A2617] border-b border-[#87A878]/20 text-[#637062] dark:text-[#A8BDA5] font-mono text-[11px]">
                      <tr>
                        <th className="p-3">Hüüdmärk / Sõlm</th>
                        <th className="p-3">Ühendus / Hops</th>
                        <th className="p-3">Signaal (RSSI / SNR)</th>
                        <th className="p-3">Link Quality (LQI)</th>
                        <th className="p-3">Latentsus (RTT)</th>
                        <th className="p-3">Saagis (PDR)</th>
                        <th className="p-3 text-right">Tegevused</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#87A878]/15">
                      {filteredPeers.map((peer) => {
                        const detail = peerDetails[peer.id];
                        const isDirect = peer.isDirect;
                        const rssiColor =
                          peer.lastRssi > -60
                            ? 'text-[#2A9D8F]'
                            : peer.lastRssi > -75
                            ? 'text-[#588157]'
                            : peer.lastRssi > -85
                            ? 'text-[#F4A261]'
                            : 'text-[#E76F51]';

                        return (
                          <tr
                            key={peer.id}
                            className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            {/* Callsign & MAC */}
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl bg-[#87A878]/20 flex items-center justify-center font-bold text-xs text-[#588157] shrink-0">
                                  {peer.callsign.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                                    {peer.callsign}
                                  </div>
                                  <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                                    {detail?.macAddress || `NODE-${peer.id.slice(0, 6)}`}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Connection State & Hop count */}
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                    isDirect
                                      ? 'bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30'
                                      : peer.hopDistance === 2
                                      ? 'bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A] border border-[#E9C46A]/40'
                                      : 'bg-[#E76F51]/15 text-[#E76F51] border border-[#E76F51]/30'
                                  }`}
                                >
                                  {isDirect ? '1 Hop (Otse)' : `${peer.hopDistance} Hops (Relee)`}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] mt-0.5">
                                Viimati nähtud: {peer.lastSeen}
                              </div>
                            </td>

                            {/* RSSI & SNR */}
                            <td className="p-3 font-mono">
                              <div className={`font-bold ${rssiColor}`}>
                                {peer.lastRssi} dBm
                              </div>
                              <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                                SNR: +{detail?.snrDb || 6.2} dB
                              </div>
                            </td>

                            {/* LQI */}
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 w-20 bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-[#2A9D8F] h-full rounded-full transition-all"
                                    style={{ width: `${((detail?.lqi || 200) / 255) * 100}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[11px] font-bold">
                                  {detail?.lqi || 210}/255
                                </span>
                              </div>
                              <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono mt-0.5">
                                Relee usaldusväärsus: {peer.relayReliability}%
                              </div>
                            </td>

                            {/* Latency RTT */}
                            <td className="p-3 font-mono">
                              <div className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                                ~{detail?.rttMs || 32} ms
                              </div>
                              <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                                Jitter: ±{detail?.jitterMs || 2.4} ms
                              </div>
                            </td>

                            {/* PDR */}
                            <td className="p-3 font-mono">
                              <div className="font-bold text-[#588157] dark:text-[#87A878]">
                                {detail?.pdrPercent || 98.4}%
                              </div>
                              <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">
                                Dropped: {detail?.droppedPackets || 1} pkts
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedPeerForTraceroute(peer)}
                                className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] dark:bg-[#1A2617] hover:bg-[#87A878]/20 border border-[#87A878]/30 font-semibold text-[11px] text-[#588157] dark:text-[#A8BDA5] inline-flex items-center gap-1 transition-all cursor-pointer"
                                title="Käivita multi-hop marsruudi traceroute"
                              >
                                <ArrowUpRight className="w-3 h-3" />
                                <span>Traceroute</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Traceroute Modal Popup if selected */}
              {selectedPeerForTraceroute && (
                <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border-2 border-[#2A9D8F] shadow-lg space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-[#87A878]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#2A9D8F] animate-ping" />
                      <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                        Traceroute marsruut sihtkohani: {selectedPeerForTraceroute.callsign}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPeerForTraceroute(null)}
                      className="text-xs text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE] p-1 rounded-md"
                    >
                      Sulge
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tracerouteHops.map((hop, idx) => (
                      <div
                        key={hop.hopIndex}
                        className="p-3 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/30 relative flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-[#2A9D8F]/20 text-[#2A9D8F] font-mono text-[10px] font-bold">
                            Hop #{hop.hopIndex}
                          </span>
                          <span className="text-[10px] font-mono text-[#588157]">
                            {hop.latencyMs} ms
                          </span>
                        </div>

                        <div className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] my-1.5">
                          {hop.callsign}
                        </div>

                        <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono space-y-0.5">
                          <div>Meedia: {hop.radioMedium}</div>
                          {hop.rssi !== 0 && <div>Signaal: {hop.rssi} dBm</div>}
                          <div>Link skoor: {hop.linkQualityScore}%</div>
                        </div>

                        {idx < tracerouteHops.length - 1 && (
                          <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-[#2A9D8F]">
                            <ArrowRight className="w-5 h-5 bg-white dark:bg-[#121A10] rounded-full" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: RF SPEKTER & KANALID (SPECTRUM & CHANNEL UTILIZATION) */}
          {/* ========================================================================= */}
          {activeTab === 'spectrum' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Channels matrix */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-[#87A878]/20 pb-2">
                    <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-[#2A9D8F]" />
                      RF Raadiokanalite koormus
                    </h4>
                    <span className="text-[10px] font-mono text-[#588157]">
                      5 aktiivset sagedust
                    </span>
                  </div>

                  <div className="space-y-3">
                    {INITIAL_CHANNEL_TELEMETRY.map((ch) => (
                      <div key={ch.channelId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">
                            {ch.name}
                          </span>
                          <span className="font-mono text-[#637062] dark:text-[#A8BDA5]">
                            {ch.frequencyMhz} MHz · {ch.utilizationPercent}% koormus
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              ch.utilizationPercent > 30
                                ? 'bg-[#E76F51]'
                                : ch.utilizationPercent > 20
                                ? 'bg-[#F4A261]'
                                : 'bg-[#2A9D8F]'
                            }`}
                            style={{ width: `${ch.utilizationPercent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                          <span>Müratase (Noise floor): {ch.noiseFloorDbm} dBm</span>
                          <span>TX Duty Cycle: {ch.txDutyCyclePercent}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RF Environment & Regulatory Status */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 shadow-xs space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#87A878]/20 pb-2">
                      <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#588157]" />
                        Eetrieeskirjad & ISM Piirangud
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#588157]/20 text-[#588157] font-bold">
                        Vastavuses
                      </span>
                    </div>

                    <div className="text-xs text-[#637062] dark:text-[#A8BDA5] space-y-2 mt-3 leading-relaxed">
                      <p>
                        🇪🇺 <strong>EU ISM Band 868.0 - 868.6 MHz:</strong> Maksimaalne lubatud TX eetriaeg on 1.0% (36 sekundit tunnis). HÕIMU nutikas piiraja hoiab hetkel koormust tasemel <strong>0.72%</strong>.
                      </p>
                      <p>
                        🔋 <strong>Päikeseenergia adaptiivne modulatsioon:</strong> Kui aku langeb alla 30%, lülitub võrk automaatselt ainult BLE reklaamipakettidele (15 min intervall) ning peatab Wi-Fi Direct suure ribalaiusega sünkroonimise.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/20 text-xs font-mono">
                    <div className="text-[#588157] font-bold mb-1">
                      Aktiivsed antenniparameetrid:
                    </div>
                    <div className="text-[11px] text-[#637062] dark:text-[#A8BDA5] space-y-0.5">
                      <div>• BLE 5.0 TX Võimsus: +8 dBm (6.3 mW)</div>
                      <div>• LoRa TX Võimsus: +14 dBm (25 mW) / SF11 Bandwidth 125kHz</div>
                      <div>• Tundlikkuspiir (Sensitivity): -137 dBm (LoRa) / -98 dBm (BLE)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: PÄIKESEENERGIA & VÕIMSUS (REAL-TIME SOLAR POWER GENERATION CHART) */}
          {/* ========================================================================= */}
          {activeTab === 'solar' && (
            <div className="space-y-4">
              <RealtimeSolarGenerationChart
                batteryStatus={batteryStatus}
                isNightMode={isNightMode}
                embedded={false}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PAKETTIVOO INSPEKTOR (WIRE LOG & PROTOCOL FRAMES) */}
          {/* ========================================================================= */}
          {activeTab === 'wirelog' && (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Pause / Resume Live Stream */}
                  <button
                    type="button"
                    onClick={() => setIsLiveStreamPaused(!isLiveStreamPaused)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isLiveStreamPaused
                        ? 'bg-[#F4A261] text-white border-[#F4A261]'
                        : 'bg-white dark:bg-[#121A10] text-[#588157] border-[#87A878]/30'
                    }`}
                  >
                    {isLiveStreamPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isLiveStreamPaused ? 'Jätka püüdmist' : 'Peata voog'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPacketLogs([])}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#121A10] hover:bg-black/5 dark:hover:bg-white/5 border border-[#87A878]/30 text-xs text-[#E76F51] font-semibold flex items-center gap-1 cursor-pointer"
                    title="Tühjenda logid"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Tühjenda</span>
                  </button>
                </div>

                {/* Frame Type Filter */}
                <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
                  <Filter className="w-3.5 h-3.5 text-[#637062] dark:text-[#A8BDA5]" />
                  {['all', 'BEACON_ADV', 'DIRECT_MSG', 'CRDT_SYNC', 'STORE_FORWARD_BUNDLE', 'TELEMETRY'].map(
                    (type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFrameFilter(type)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          frameFilter === type
                            ? 'bg-[#2A9D8F] text-white'
                            : 'bg-white dark:bg-[#121A10] text-[#637062] dark:text-[#A8BDA5] border border-[#87A878]/30'
                        }`}
                      >
                        {type === 'all' ? 'Kõik tüübid' : type}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Packet Stream Log Table */}
              <div className="border border-[#87A878]/30 rounded-2xl overflow-hidden bg-white dark:bg-[#121A10] shadow-xs">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#FAF6EE] dark:bg-[#1A2617] border-b border-[#87A878]/20 text-[#637062] dark:text-[#A8BDA5] font-mono text-[10px]">
                      <tr>
                        <th className="p-2.5">Aeg</th>
                        <th className="p-2.5">Raamitüüp</th>
                        <th className="p-2.5">Allikas -&gt; Sihtkoht</th>
                        <th className="p-2.5">Hops</th>
                        <th className="p-2.5">Signaal</th>
                        <th className="p-2.5">Suurus</th>
                        <th className="p-2.5">Sisukokkuvõte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#87A878]/15 font-mono text-[11px]">
                      {filteredPackets.map((pkt) => {
                        const typeColor =
                          pkt.frameType === 'BEACON_ADV'
                            ? 'bg-[#2A9D8F]/15 text-[#2A9D8F]'
                            : pkt.frameType === 'DIRECT_MSG'
                            ? 'bg-[#E9C46A]/20 text-[#8C6207] dark:text-[#E9C46A]'
                            : pkt.frameType === 'STORE_FORWARD_BUNDLE'
                            ? 'bg-[#E76F51]/15 text-[#E76F51]'
                            : pkt.frameType === 'CRDT_SYNC'
                            ? 'bg-[#588157]/15 text-[#588157]'
                            : 'bg-black/10 dark:bg-white/10 text-[#637062] dark:text-[#A8BDA5]';

                        return (
                          <tr
                            key={pkt.id}
                            onClick={() => setSelectedPacketForInspect(pkt)}
                            className="hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            <td className="p-2.5 text-[#637062] dark:text-[#A8BDA5]">
                              {new Date(pkt.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>

                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${typeColor}`}>
                                {pkt.frameType}
                              </span>
                            </td>

                            <td className="p-2.5 font-bold">
                              <span className="text-[#203A2A] dark:text-[#F0F5EE]">{pkt.sourceCallsign}</span>
                              <span className="text-[#637062] dark:text-[#A8BDA5] mx-1">→</span>
                              <span className="text-[#588157]">{pkt.destCallsign}</span>
                            </td>

                            <td className="p-2.5">{pkt.hopCount}/{pkt.maxHops}</td>

                            <td className="p-2.5">
                              <span className="text-[#2A9D8F]">{pkt.rssi} dBm</span>
                            </td>

                            <td className="p-2.5 text-[#637062] dark:text-[#A8BDA5]">{pkt.payloadBytes} B</td>

                            <td className="p-2.5 truncate max-w-xs text-[#637062] dark:text-[#A8BDA5]">
                              <div className="flex items-center gap-1">
                                {pkt.encrypted && <Lock className="w-3 h-3 text-[#E9C46A] shrink-0" />}
                                <span className="truncate">{pkt.payloadSummary}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Packet Payload Inspector Drawer if selected */}
              {selectedPacketForInspect && (
                <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border-2 border-[#588157] shadow-lg space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-[#87A878]/20 pb-2">
                    <h5 className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5 font-mono">
                      <Layers className="w-3.5 h-3.5 text-[#588157]" />
                      Paketi dekrüpteeritud struktuur ({selectedPacketForInspect.id})
                    </h5>
                    <button
                      type="button"
                      onClick={() => setSelectedPacketForInspect(null)}
                      className="text-xs text-[#637062] dark:text-[#A8BDA5] hover:text-[#203A2A] dark:hover:text-[#F0F5EE]"
                    >
                      Sulge inspektor
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-[#637062] dark:text-[#A8BDA5]">
                    <div>Raam: <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">{selectedPacketForInspect.frameType}</span></div>
                    <div>Krüpteering: <span className="text-[#2A9D8F] font-bold">{selectedPacketForInspect.encrypted ? 'ChaCha20-Poly1305' : 'Avalik (Plaintext)'}</span></div>
                    <div>CRC32 kontroll: <span className="text-[#588157] font-bold">Kehtiv ✓</span></div>
                    <div>SNR tase: <span className="text-[#E9C46A] font-bold">+{selectedPacketForInspect.snr} dB</span></div>
                  </div>

                  <pre className="p-3 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/30 font-mono text-[10px] text-[#203A2A] dark:text-[#F0F5EE] overflow-x-auto">
                    {selectedPacketForInspect.rawPayloadJson}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: DTN PUHVER & SALVESTUS (STORE-AND-FORWARD DTN QUEUE) */}
          {/* ========================================================================= */}
          {activeTab === 'dtn' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 shadow-xs space-y-2">
                  <span className="text-xs font-medium text-[#637062] dark:text-[#A8BDA5]">
                    Puhvris olevad DTN paketid
                  </span>
                  <div className="font-bold text-2xl text-[#203A2A] dark:text-[#F0F5EE]">
                    4 kimpu (Bundles)
                  </div>
                  <p className="text-[11px] text-[#588157]">
                    Ootavad füüsilist kontakti releesõlmedega
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 shadow-xs space-y-2">
                  <span className="text-xs font-medium text-[#637062] dark:text-[#A8BDA5]">
                    Välkmälu kasutus (Flash Storage)
                  </span>
                  <div className="font-bold text-2xl text-[#203A2A] dark:text-[#F0F5EE]">
                    48.2 KB / 512 KB
                  </div>
                  <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#2A9D8F] h-full rounded-full w-[9.4%]" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 shadow-xs space-y-2">
                  <span className="text-xs font-medium text-[#637062] dark:text-[#A8BDA5]">
                    Bloom Filter deduplikatsioon
                  </span>
                  <div className="font-bold text-2xl text-[#2A9D8F]">
                    0.02% veamäär
                  </div>
                  <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5]">
                    Hoiab ära samade pakettide topeltreleerimise
                  </p>
                </div>
              </div>

              {/* Active Bundles in Queue List */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 shadow-xs space-y-3">
                <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-[#2A9D8F]" />
                  Aktiivsed ootel olevad DTN kimbud (Store-and-Forward Queue)
                </h4>

                <div className="space-y-2">
                  {[
                    {
                      id: 'bnd-4812',
                      target: 'Spore-Walker (Cascadia-South)',
                      size: '1.2 KB',
                      ttl: '42h jäänud',
                      desc: 'Võrguväline ressursside vahetuspäring + Ed25519 allkiri',
                    },
                    {
                      id: 'bnd-4813',
                      target: 'River-Oak (Cascadia-East)',
                      size: '4.8 KB',
                      ttl: '68h jäänud',
                      desc: 'Bioregiooni DAO hääletuse CRDT delta olekute uuendus',
                    },
                  ].map((bnd) => (
                    <div
                      key={bnd.id}
                      className="p-3 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/20 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-2">
                          <span>{bnd.id}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#2A9D8F]/15 text-[#2A9D8F]">
                            Siht: {bnd.target}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#637062] dark:text-[#A8BDA5] mt-0.5">
                          {bnd.desc}
                        </p>
                      </div>

                      <div className="text-right text-xs font-mono">
                        <span className="font-bold text-[#588157]">{bnd.ttl}</span>
                        <div className="text-[10px] text-[#637062] dark:text-[#A8BDA5]">{bnd.size}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: LINK BUDGET & TÖÖRIISTAD (CALCULATOR & BENCHMARK) */}
          {/* ========================================================================= */}
          {activeTab === 'benchmark' && (
            <div className="space-y-6">
              {/* Free Space Path Loss (FSPL) & Link Budget Calculator */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#121A10] border border-[#87A878]/30 shadow-xs space-y-4">
                <div className="border-b border-[#87A878]/20 pb-2">
                  <h4 className="font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#2A9D8F]" />
                    RF Link Budget & Teoreetiline sumbumise kalkulaator (FSPL)
                  </h4>
                  <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mt-0.5">
                    Arvutab signaali sumbumist vabas ruumis vastavalt vahemaale ja sagedusele.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sliders */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span>Vahemaa sihtsõlmeni:</span>
                        <span className="text-[#2A9D8F] font-mono">{calcDistanceM} meetrit</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="3000"
                        step="10"
                        value={calcDistanceM}
                        onChange={(e) => setCalcDistanceM(Number(e.target.value))}
                        className="w-full accent-[#2A9D8F] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span>Sagedusala:</span>
                        <span className="text-[#2A9D8F] font-mono">{calcFreqMhz} MHz</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '868 MHz (LoRa)', val: 868 },
                          { label: '2.4 GHz (BLE)', val: 2400 },
                          { label: '5.8 GHz (Wi-Fi)', val: 5800 },
                        ].map((item) => (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => setCalcFreqMhz(item.val)}
                            className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              calcFreqMhz === item.val
                                ? 'bg-[#2A9D8F] text-white border-[#2A9D8F]'
                                : 'bg-[#FAF6EE] dark:bg-[#182315] text-[#637062] dark:text-[#A8BDA5] border-[#87A878]/30'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Calculated Results */}
                  <div className="p-4 rounded-xl bg-[#FAF6EE] dark:bg-[#182315] border border-[#87A878]/25 flex flex-col justify-between space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-[#637062] dark:text-[#A8BDA5] text-[10px]">Tee sumbuvus (FSPL):</span>
                        <div className="font-bold text-base text-[#203A2A] dark:text-[#F0F5EE]">
                          -{calculatedBudget.fsplDb} dB
                        </div>
                      </div>

                      <div>
                        <span className="text-[#637062] dark:text-[#A8BDA5] text-[10px]">Oodatav signaal (RSSI):</span>
                        <div className="font-bold text-base text-[#2A9D8F]">
                          {calculatedBudget.expectedRssiDbm} dBm
                        </div>
                      </div>

                      <div>
                        <span className="text-[#637062] dark:text-[#A8BDA5] text-[10px]">Link Margin:</span>
                        <div className="font-bold text-base text-[#588157]">
                          +{calculatedBudget.linkMarginDb} dB
                        </div>
                      </div>

                      <div>
                        <span className="text-[#637062] dark:text-[#A8BDA5] text-[10px]">Ühenduse hinnang:</span>
                        <div className="font-bold text-xs text-[#203A2A] dark:text-[#F0F5EE]">
                          <span className="px-2 py-0.5 rounded-full bg-[#588157]/20 text-[#588157]">
                            {calculatedBudget.qualityAssessment}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#637062] dark:text-[#A8BDA5] leading-snug">
                      ℹ️ <em>Fresneli tsooni soovitus:</em> 350m kaugusel soovitame antenni tõsta vähemalt 2 meetrit maapinnast kõrgemale takistustest möödumiseks.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: P2P CRDT SÜNKROONIMINE (DECENTRALIZED STATE SYNC) */}
          {/* ========================================================================= */}
          {activeTab === 'crdt' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-[#E76F51]/10 border border-[#E76F51]/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h4 className="font-display font-bold text-base text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                    <RefreshCw className="w-5 h-5 text-[#E76F51] animate-spin-slow" />
                    Keskuseta P2P replikatsioon (CRDT sünkroniseerimine)
                  </h4>
                  <p className="text-xs text-[#637062] dark:text-[#A8BDA5] mt-1 leading-relaxed">
                    HÕIMU kasutab LWW-Element-Set (Last-Write-Wins) konfliktivaba replikatsioonimootorit. See võimaldab täielikku andmevahetust ilma keskse serverita, edastades sünkroonimispakette otse üle BLE või LoRa võrgu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateCrdtSync}
                  disabled={isCrdtSyncing}
                  className="px-4 py-2.5 rounded-xl bg-[#E76F51] hover:bg-[#d65f42] text-white text-xs font-bold shrink-0 shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Radio className={`w-4 h-4 ${isCrdtSyncing ? 'animate-pulse' : ''}`} />
                  <span>{isCrdtSyncing ? 'Sünkroniseerib lähedalasuva seadmega...' : 'Simuleeri BLE/LoRa sünkroonimist'}</span>
                </button>
              </div>

              {(crdtSuccess || crdtError) && (
                <div className="grid grid-cols-1 gap-2">
                  {crdtSuccess && (
                    <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-xs text-green-500 flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0 animate-bounce" />
                      <span>{crdtSuccess}</span>
                    </div>
                  )}
                  {crdtError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{crdtError}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Manual export/import */}
                <div className={`p-4 rounded-2xl border flex flex-col gap-3.5 ${
                  isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/25'
                }`}>
                  <h5 className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE] flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-[#588157]" />
                    Kahe seadme vaheline sünkroniseerimine
                  </h5>
                  <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed">
                    Kui seadmete raadiokanal on maas, kopeeri oma sünkroniseerimise token partneri seadmesse (nt üle paberi, QR-koodi või teksti).
                  </p>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase">Minu andmete sünkrotoken (Eksport)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getCrdtExportToken().slice(0, 36) + '... (klikates kopeerib)'}
                        onClick={handleCopyCrdtToken}
                        className="flex-1 p-2 text-xs font-mono rounded-xl border border-current/10 bg-black/5 dark:bg-white/5 cursor-pointer focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyCrdtToken}
                        className="px-3 py-2 rounded-xl bg-[#588157] text-white text-xs font-bold transition-all hover:bg-[#466645] flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopeeri</span>
                      </button>
                    </div>
                  </div>

                  <hr className="border-current/10" />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#637062] dark:text-[#A8BDA5] uppercase">Kleebi partneri token (Import)</label>
                    <textarea
                      value={crdtImportValue}
                      onChange={(e) => setCrdtImportValue(e.target.value)}
                      rows={3}
                      className="p-2 text-xs font-mono rounded-xl border border-current/10 bg-transparent focus:outline-none focus:border-[#E76F51] resize-none"
                      placeholder="Kleebi partneri sünkroonimistoken siia..."
                    />
                    <button
                      type="button"
                      onClick={handleCrdtImport}
                      className="w-full py-2 rounded-xl border border-[#E76F51]/30 hover:bg-[#E76F51]/10 text-[#E76F51] font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Ühenda andmed kohaliku andmebaasiga</span>
                    </button>
                  </div>
                </div>

                {/* Console logs */}
                <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
                  isNightMode ? 'bg-black text-[#87A878] border-[#2A3B26]' : 'bg-[#182315] text-[#A8BDA5] border-[#87A878]/30'
                } font-mono text-xs overflow-hidden`}>
                  <div className="flex items-center justify-between border-b border-current/15 pb-2 shrink-0">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-white">LWW-Element-Set replikatsiooni silur</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[300px] pr-1">
                    {crdtLogs.map((logLine, idx) => (
                      <div key={idx} className="leading-snug">
                        <span className="text-white/30 mr-1.5">[{idx + 1}]</span>
                        <span>{logLine}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sync History Log Table */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-white border-[#87A878]/30 shadow-xs'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#2A9D8F]" />
                    <h5 className="font-display font-bold text-sm text-[#203A2A] dark:text-[#F0F5EE]">
                      Sync History
                    </h5>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#2A9D8F]/15 text-[#2A9D8F] border border-[#2A9D8F]/30">
                      {successfulSyncPackets.length} edukat paketti
                    </span>
                  </div>
                  <span className="text-[11px] text-[#637062] dark:text-[#A8BDA5] font-mono">
                    CRDT_SYNC • CRC32 Valid • Ad-Hoc Replikatsioon
                  </span>
                </div>

                {successfulSyncPackets.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-current/10">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className={`border-b border-current/10 font-mono text-[11px] ${
                          isNightMode ? 'bg-black/30 text-[#A8BDA5]' : 'bg-[#FAF6EE] text-[#588157]'
                        }`}>
                          <th className="py-2.5 px-3">Ajatempel (Timestamp)</th>
                          <th className="py-2.5 px-3">Partneri hüüdmärk (Peer Callsign)</th>
                          <th className="py-2.5 px-3">Andmemaht (Data Size)</th>
                          <th className="py-2.5 px-3">Signaal (RSSI / SNR)</th>
                          <th className="py-2.5 px-3">Hüpped (Hops)</th>
                          <th className="py-2.5 px-3">Olek (Status)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-current/10 font-mono">
                        {successfulSyncPackets.map((pkt) => {
                          const dateObj = new Date(pkt.timestamp);
                          const timeStr = dateObj.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          const diffSec = Math.max(0, Math.round((Date.now() - pkt.timestamp) / 1000));
                          const agoStr = diffSec < 60 ? `${diffSec}s tagasi` : `${Math.round(diffSec / 60)}min tagasi`;
                          const sizeStr = pkt.payloadBytes >= 1024 
                            ? `${(pkt.payloadBytes / 1024).toFixed(1)} KB` 
                            : `${pkt.payloadBytes} B`;

                          return (
                            <tr
                              key={pkt.id}
                              className={`transition-colors ${
                                isNightMode ? 'hover:bg-white/5' : 'hover:bg-[#F0F5EE]'
                              }`}
                            >
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="font-bold text-[#203A2A] dark:text-[#F0F5EE]">{timeStr}</span>
                                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] ml-1.5 opacity-80">({agoStr})</span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#2A9D8F]/10 text-[#2A9D8F] font-bold border border-[#2A9D8F]/25">
                                  <Radio className="w-3 h-3 shrink-0" />
                                  <span>{pkt.sourceCallsign}</span>
                                </span>
                                <span className="text-[10px] text-[#637062] dark:text-[#A8BDA5] ml-1.5">
                                  {pkt.sourceNodeId}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap font-bold text-[#E76F51]">
                                {sizeStr}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-[#637062] dark:text-[#A8BDA5]">
                                <span className="text-[#203A2A] dark:text-[#F0F5EE] font-semibold">{pkt.rssi} dBm</span>
                                {pkt.snr !== undefined && (
                                  <span className="text-[10px] ml-1 opacity-80">({pkt.snr} dB)</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-[#637062] dark:text-[#A8BDA5]">
                                {pkt.hopCount} / {pkt.maxHops}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-500">
                                  <Check className="w-3 h-3" />
                                  <span>Edukas (CRC OK)</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-[#87A878]/30 text-center text-xs text-[#637062] dark:text-[#A8BDA5] font-mono">
                    Sünkroonimispakette pole veel talletatud. Käivita sünkroonimine nupust "Simuleeri BLE/LoRa sünkroonimist".
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-3 border-t flex items-center justify-between text-xs font-mono transition-colors ${
            isNightMode ? 'bg-[#121A10] border-[#2A3B26]' : 'bg-[#FAF6EE] border-[#87A878]/20'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[#588157]">
            <CheckCircle2 className="w-4 h-4" />
            <span>Kõik kohalikud raadiod töötavad võrguühenduseta (Zero-Cloud Verified)</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#203A2A] dark:bg-[#2A3B26] hover:bg-[#16271c] text-white font-bold transition-all cursor-pointer"
          >
            Sulge
          </button>
        </div>
      </div>
    </div>
  );
};
