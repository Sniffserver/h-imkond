import { MeshNode, ResourceItem } from '../../../types';

export function renderAsciiFrame(
  peers: MeshNode[],
  resources: ResourceItem[],
  cols: number = 40,
  rows: number = 16
): string {
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill('.'));

  // Center user
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  grid[cy][cx] = '▲';

  // Plot peers
  peers.slice(0, 10).forEach((peer, i) => {
    const px = (cx + ((i % 5) - 2) * 3 + cols) % cols;
    const py = (cy + (Math.floor(i / 5) - 1) * 2 + rows) % rows;
    const isActive = peer.isDirect || peer.connectionState === 'direct';
    grid[py][px] = isActive ? 'P' : 'p';
  });

  // Plot resources
  resources.slice(0, 10).forEach((res, i) => {
    const rx = (cx + (i % 4) * 2 - 3 + cols) % cols;
    const ry = (cy + Math.floor(i / 4) * 2 - 2 + rows) % rows;
    grid[ry][rx] = 'R';
  });

  return grid.map((row) => row.join(' ')).join('\n');
}
