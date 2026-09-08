import { MeshNode } from '../../../types';
import { SpatialGridCluster } from '../mapState';

export function drawPeersLayer(
  ctx: CanvasRenderingContext2D,
  peers: MeshNode[],
  clusters: SpatialGridCluster<MeshNode>[],
  projectLatOption: (lat: number, lng: number) => { x: number; y: number },
  isDark: boolean
) {
  // 1. Draw Clusters
  clusters.forEach((cluster) => {
    const pt = projectLatOption(cluster.centerLat, cluster.centerLng);
    const radius = Math.min(30, 14 + Math.log2(cluster.count) * 4);

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#2A3B26' : '#588157';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isDark ? '#E9C46A' : '#FAF6EE';
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${cluster.count}`, pt.x, pt.y);
  });

  // 2. Draw Individual Visible Peers
  peers.forEach((peer) => {
    const lat = (peer as any).lat ?? (59.437 + (peer.distanceRatio || 0.1) * 0.01 * Math.cos((peer.angle || 0) * Math.PI / 180));
    const lng = (peer as any).lng ?? (24.7535 + (peer.distanceRatio || 0.1) * 0.01 * Math.sin((peer.angle || 0) * Math.PI / 180));
    const pt = projectLatOption(lat, lng);
    const isActive = peer.isDirect || peer.connectionState === 'direct';

    // Pulse outer aura
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? 'rgba(52, 199, 89, 0.2)' : 'rgba(231, 111, 81, 0.2)';
    ctx.fill();

    // Solid core
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? '#34C759' : '#E76F51';
    ctx.fill();

    // Peer Callsign Label
    if (peers.length < 50) {
      ctx.fillStyle = isDark ? '#F0F5EE' : '#203A2A';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(peer.callsign, pt.x, pt.y + 16);
    }
  });
}
