/**
 * PacketCompressor
 * Implements packet-aware adaptive compression for HÕIMU LoRa/BLE mesh networking.
 * 
 * Requirement 45:
 * - Small payload (< COMPRESSION_THRESHOLD = 64 bytes): no compression (avoids header overhead bloat).
 * - Large payload (>= COMPRESSION_THRESHOLD = 64 bytes): attempt compression (LZ77/RLE/Deflate).
 * - Compression Fallback: If compressed output is NOT smaller than original payload, transmit original uncompressed bytes.
 */

export const COMPRESSION_THRESHOLD_BYTES = 64;

export interface CompressionResult {
  compressed: boolean;
  data: Uint8Array;
  originalSize: number;
  finalSize: number;
  savingPercent: number;
}

/**
 * Simple run-length & byte dictionary compressor optimized for RF packet payloads
 */
export function compressPayload(input: Uint8Array): Uint8Array {
  const output: number[] = [0x01]; // Compression header flag
  let i = 0;
  while (i < input.length) {
    let runLen = 1;
    while (i + runLen < input.length && input[i + runLen] === input[i] && runLen < 255) {
      runLen++;
    }

    if (runLen >= 4) {
      output.push(0xfe, runLen, input[i]); // Run token
      i += runLen;
    } else {
      output.push(input[i]);
      i++;
    }
  }
  return new Uint8Array(output);
}

/**
 * Decompresses a compressed payload buffer
 */
export function decompressPayload(compressedInput: Uint8Array): Uint8Array {
  if (compressedInput.length === 0) return new Uint8Array(0);
  if (compressedInput[0] !== 0x01) {
    // Uncompressed
    return compressedInput;
  }

  const output: number[] = [];
  let i = 1;
  while (i < compressedInput.length) {
    if (compressedInput[i] === 0xfe && i + 2 < compressedInput.length) {
      const runLen = compressedInput[i + 1];
      const val = compressedInput[i + 2];
      for (let r = 0; r < runLen; r++) {
        output.push(val);
      }
      i += 3;
    } else {
      output.push(compressedInput[i]);
      i++;
    }
  }
  return new Uint8Array(output);
}

export class PacketCompressor {
  /**
   * Adaptive compression policy (Requirement 45)
   */
  public static processOutbound(
    payload: Uint8Array,
    threshold: number = COMPRESSION_THRESHOLD_BYTES
  ): CompressionResult {
    const originalSize = payload.length;

    // Rule 1: Small payloads < threshold -> NO COMPRESSION
    if (originalSize < threshold) {
      return {
        compressed: false,
        data: payload,
        originalSize,
        finalSize: originalSize,
        savingPercent: 0,
      };
    }

    // Rule 2: Payload >= threshold -> Try compression
    const compressedCandidate = compressPayload(payload);
    const compressedSize = compressedCandidate.length;

    // Rule 3: If compressed output >= original payload -> Fallback to ORIGINAL
    if (compressedSize >= originalSize) {
      return {
        compressed: false,
        data: payload,
        originalSize,
        finalSize: originalSize,
        savingPercent: 0,
      };
    }

    const savingPercent = Number((((originalSize - compressedSize) / originalSize) * 100).toFixed(1));

    return {
      compressed: true,
      data: compressedCandidate,
      originalSize,
      finalSize: compressedSize,
      savingPercent,
    };
  }

  /**
   * Decompresses inbound payload if compressed flag is active
   */
  public static processInbound(data: Uint8Array, isCompressedFlag: boolean): Uint8Array {
    if (!isCompressedFlag) {
      return data;
    }
    return decompressPayload(data);
  }
}
