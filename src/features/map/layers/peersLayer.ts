import { MeshNode } from '../../../types';
import { SpatialGridCluster } from '../mapState';

export function drawPeersLayer(
  ctx: CanvasRenderingContext2D,
  peers: MeshNode[],
  clusters: SpatialGridCluster<MeshNode>[],
  projectLatOption: (lat: number, lng: number) => { x: number; y: number },
  isDark: boolean
) {
  // 1. Draw Mesh Network Topology Interconnect Links & Signal Strength Indicators
  const peerPoints = peers.map((peer) => {
    const lat = (peer as any).lat ?? (59.437 + (peer.distanceRatio || 0.1) * 0.01 * Math.cos(((peer.angle || 0) * Math.PI) / 180));
    const lng = (peer as any).lng ?? (24.7535 + (peer.distanceRatio || 0.1) * 0.01 * Math.sin(((peer.angle || 0) * Math.PI) / 180));
    const pt = projectLatOption(lat, lng);
    return { peer, pt, lat, lng };
  });

  if (peerPoints.length > 1 && peerPoints.length < 100) {
    for (let i = 0; i < peerPoints.length; i++) {
      for (let j = i + 1; j < peerPoints.length; j++) {
        const p1 = peerPoints[i];
        const p2 = peerPoints[j];
        const dx = p1.pt.x - p2.pt.x;
        const dy = p1.pt.y - p2.pt.y;
        const distPx = Math.hypot(dx, dy);

        // Render topology link between peers within RF proximity
        if (distPx <= 220) {
          const avgRssi = Math.round((p1.peer.lastRssi + p2.peer.lastRssi) / 2);
          let linkColor = isDark ? '#33ff00' : '#10B981';
          if (avgRssi < -85) linkColor = '#EF4444';
          else if (avgRssi < -75) linkColor = '#E9C46A';
          else if (avgRssi < -65) linkColor = isDark ? '#588157' : '#588157';

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1.pt.x, p1.pt.y);
          ctx.lineTo(p2.pt.x, p2.pt.y);
          ctx.strokeStyle = linkColor;
          ctx.lineWidth = avgRssi >= -65 ? 2 : 1.2;
          ctx.globalAlpha = avgRssi < -85 ? 0.45 : 0.65;
          if (avgRssi < -85) {
            ctx.setLineDash([4, 4]);
          }
          ctx.stroke();

          // Signal strength badge at link midpoint
          const midX = (p1.pt.x + p2.pt.x) / 2;
          const midY = (p1.pt.y + p2.pt.y) / 2;
          const badgeText = `${avgRssi} dBm`;
          ctx.font = 'bold 9px monospace';
          const textWidth = ctx.measureText(badgeText).width;
          const padX = 4;
          const padY = 2;

          ctx.fillStyle = isDark ? 'rgba(20, 31, 18, 0.92)' : 'rgba(255, 255, 255, 0.92)';
          ctx.strokeStyle = linkColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(midX - textWidth / 2 - padX, midY - 6 - padY, textWidth + padX * 2, 13 + padY, 3);
          } else {
            ctx.rect(midX - textWidth / 2 - padX, midY - 6 - padY, textWidth + padX * 2, 13 + padY);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = linkColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, midX, midY + 1);
          ctx.restore();
        }
      }
    }
  }

  // 2. Draw Clusters
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
