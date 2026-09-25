/**
 * overlayRenderer.ts
 * 
 * HÕIMU Tactical Overlay Renderer.
 * 
 * Architecture:
 * - MapLibre is the CANONICAL geographic renderer (vector tiles, projections, viewport, PMTiles).
 * - OverlayRenderer renders tactical and telemetry overlays (peers, links, resources, signal coverage)
 *   via either WebGL (high-density/hardware accelerated) or Canvas 2D (crisp tactical vector).
 * - ASCII mode is available as an explicit low-power fallback.
 */

import { GeoCoordinate } from './mapEngine';
import { WebGlRendererContext } from './renderers/webglRenderer';

export interface OverlayElement {
  id: string;
  type: 'peer' | 'resource' | 'link' | 'range' | 'custom';
  coordinate?: GeoCoordinate;
  targetCoordinate?: GeoCoordinate;
  color?: string;
  label?: string;
  radiusMeters?: number;
  data?: any;
}

export class OverlayRenderer {
  /**
   * Renders tactical overlay elements to a 2D Canvas context using projected screen coordinates.
   */
  public static renderCanvasOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    project: (coord: GeoCoordinate) => { x: number; y: number },
    elements: OverlayElement[],
    options?: { isNightMode?: boolean; theme?: string }
  ): void {
    ctx.save();

    // 1. Draw Links / Vectors first
    elements.forEach((elem) => {
      if (elem.type === 'link' && elem.coordinate && elem.targetCoordinate) {
        const p1 = project(elem.coordinate);
        const p2 = project(elem.targetCoordinate);

        ctx.beginPath();
        ctx.strokeStyle = elem.color || '#588157';
        ctx.lineWidth = 2;
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    // 2. Draw Range Circles
    elements.forEach((elem) => {
      if (elem.type === 'range' && elem.coordinate && elem.radiusMeters) {
        const p = project(elem.coordinate);
        // Estimate radius in pixels via a slight coordinate delta
        const pRadiusEdge = project({
          lat: elem.coordinate.lat,
          lng: elem.coordinate.lng + (elem.radiusMeters / 111320) * Math.cos((elem.coordinate.lat * Math.PI) / 180),
        });
        const radiusPx = Math.max(4, Math.abs(pRadiusEdge.x - p.x));

        ctx.beginPath();
        ctx.fillStyle = elem.color ? `${elem.color}22` : 'rgba(42, 157, 143, 0.15)';
        ctx.strokeStyle = elem.color || 'rgba(42, 157, 143, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    // 3. Draw Nodes and Resources
    elements.forEach((elem) => {
      if ((elem.type === 'peer' || elem.type === 'resource') && elem.coordinate) {
        const p = project(elem.coordinate);
        if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) return;

        ctx.beginPath();
        ctx.fillStyle = elem.color || (elem.type === 'peer' ? '#2A9D8F' : '#E76F51');
        ctx.arc(p.x, p.y, elem.type === 'peer' ? 6 : 5, 0, Math.PI * 2);
        ctx.fill();

        if (elem.label) {
          ctx.font = '10px monospace';
          ctx.fillStyle = options?.isNightMode ? '#FAF6EE' : '#203A2A';
          ctx.fillText(elem.label, p.x + 8, p.y + 3);
        }
      }
    });

    ctx.restore();
  }

  /**
   * Hardware-accelerated WebGL overlay pass for large point/link sets.
   */
  public static renderWebGlOverlay(
    webglCtx: WebGlRendererContext,
    width: number,
    height: number,
    project: (coord: GeoCoordinate) => { x: number; y: number },
    elements: OverlayElement[]
  ): void {
    const { gl, program } = webglCtx;
    if (!gl || !program) return;

    gl.viewport(0, 0, width, height);
    gl.useProgram(program);

    // Dynamic point positions buffer
    const positions: number[] = [];
    elements.forEach((elem) => {
      if (elem.coordinate) {
        const p = project(elem.coordinate);
        positions.push(p.x, p.y);
      }
    });

    if (positions.length === 0) return;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(program, 'aPosition');
    const resUniform = gl.getUniformLocation(program, 'uResolution');
    const colorUniform = gl.getUniformLocation(program, 'uColor');

    if (posAttr >= 0) {
      gl.enableVertexAttribArray(posAttr);
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);
    }
    if (resUniform) {
      gl.uniform2f(resUniform, width, height);
    }
    if (colorUniform) {
      gl.uniform4f(colorUniform, 0.16, 0.62, 0.56, 1.0);
    }

    gl.drawArrays(gl.POINTS, 0, positions.length / 2);
    gl.deleteBuffer(buffer);
  }
}
