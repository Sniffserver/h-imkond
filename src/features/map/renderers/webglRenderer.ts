import { MapEngineState } from '../mapState';

export interface WebGlRendererContext {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  program: WebGLProgram | null;
}

export function initWebGlRenderer(canvas: HTMLCanvasElement): WebGlRendererContext | null {
  try {
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext;
    if (!gl) return null;

    // Simple shaders for accelerated vector rendering
    const vsSource = `
      attribute vec2 aPosition;
      uniform vec2 uResolution;
      void main() {
        vec2 zeroToOne = aPosition / uResolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 clipSpace = zeroToTwo - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        gl_PointSize = 8.0;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec4 uColor;
      void main() {
        gl_FragColor = uColor;
      }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    return { gl, program };
  } catch {
    return null;
  }
}

export function renderWebGlFrame(
  webglCtx: WebGlRendererContext,
  width: number,
  height: number,
  state: MapEngineState
) {
  const { gl, program } = webglCtx;
  if (!gl || !program) return;

  gl.viewport(0, 0, width, height);
  gl.clearColor(0.07, 0.1, 0.06, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
}
