import React, { useEffect, useRef } from 'react';

interface SolarpunkAvatarCanvasProps {
  seed: string;
  size?: number;
  className?: string;
}

// Simple deterministic hash from string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// PRNG from seed
function createRandom(seedNum: number) {
  let s = seedNum % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const PALETTE = [
  '#87A878', // Sage
  '#F4A261', // Amber
  '#E76F51', // Terracotta
  '#E9C46A', // Solar Gold
  '#2A9D8F', // Bioregional Teal
  '#588157', // Forest Green
  '#3A5A40', // Deep Moss
  '#D4A373', // Organic Clay
];

export const SolarpunkAvatarCanvas: React.FC<SolarpunkAvatarCanvasProps> = ({
  seed,
  size = 48,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const rand = createRandom(hashString(seed || 'hoimu-seed'));
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.46;

    ctx.clearRect(0, 0, size, size);

    // 1. Background disc with warm organic gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const c1 = PALETTE[Math.floor(rand() * PALETTE.length)];
    const c2 = PALETTE[Math.floor(rand() * PALETTE.length)];
    bgGrad.addColorStop(0, '#FAF6EE');
    bgGrad.addColorStop(0.8, '#F0F4ED');
    bgGrad.addColorStop(1, c1 + '33');

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = c1 + '88';
    ctx.stroke();

    // 2. Leaf Fractals & Petals
    const petalCount = 4 + Math.floor(rand() * 5); // 4 to 8 petals
    const petalLength = radius * (0.5 + rand() * 0.35);
    const petalColor = PALETTE[Math.floor(rand() * PALETTE.length)];

    ctx.save();
    ctx.translate(cx, cy);
    const rotationOffset = rand() * Math.PI;

    for (let i = 0; i < petalCount; i++) {
      const angle = rotationOffset + (i * 2 * Math.PI) / petalCount;
      ctx.save();
      ctx.rotate(angle);

      // Draw leaf shape with bezier curves
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(petalLength * 0.5, petalLength * 0.35, petalLength, 0);
      ctx.quadraticCurveTo(petalLength * 0.5, -petalLength * 0.35, 0, 0);
      ctx.fillStyle = petalColor + '55';
      ctx.fill();
      ctx.strokeStyle = petalColor + 'AA';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Leaf vein
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(petalLength * 0.85, 0);
      ctx.strokeStyle = petalColor + 'CC';
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();

    // 3. Circuit-line solar tracings
    const circuitPoints = 3 + Math.floor(rand() * 4);
    const circuitColor = PALETTE[Math.floor(rand() * PALETTE.length)];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.strokeStyle = circuitColor + 'BB';
    ctx.lineWidth = 1.2;

    for (let j = 0; j < circuitPoints; j++) {
      const a1 = (j * 2 * Math.PI) / circuitPoints + rand() * 0.5;
      const r1 = radius * (0.3 + rand() * 0.4);
      const px = Math.cos(a1) * r1;
      const py = Math.sin(a1) * r1;

      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);

      // Mini solar node dot
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();

    // 4. Central Sun-Ray Core Polygon
    const coreRays = 3 + Math.floor(rand() * 4);
    const coreRadius = radius * 0.25;
    const coreColor = '#E9C46A';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let k = 0; k < coreRays * 2; k++) {
      const r = k % 2 === 0 ? coreRadius : coreRadius * 0.5;
      const a = (k * Math.PI) / coreRays;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = coreColor;
    ctx.fill();
    ctx.strokeStyle = '#F4A261';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center jewel
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#E76F51';
    ctx.fill();

    ctx.restore();
  }, [seed, size]);

  return (
    <canvas
      ref={canvasRef}
      id={`avatar-${seed.replace(/[^a-zA-Z0-9]/g, '')}`}
      style={{ width: size, height: size }}
      className={`rounded-full shrink-0 inline-block align-middle shadow-xs ${className}`}
    />
  );
};
