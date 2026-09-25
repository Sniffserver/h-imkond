/**
 * CompactBinaryCodec
 * Primary RF binary serialization layer for HÕIMU mesh packets.
 * 
 * Requirement 46:
 * - Application layer: Uses structured JSON objects for UI / debug / export / API representations.
 * - RF layer: Serializes packet-type-specific compact binary bodies (wire header + binary body + signature + CRC).
 * - Drastically reduces airtime and memory overhead compared to raw JSON strings over LoRa.
 */

import { encodeBinaryPacket, decodeBinaryPacket, PacketType, BinaryHeader, BinaryPacket } from './binaryPacket';

export interface MessagePayloadBinary {
  recipientId: string;
  text: string;
  timestamp: number;
}

export interface SosPayloadBinary {
  latitude: number;
  longitude: number;
  batteryPercent: number;
  emergencyCode: number;
  callsign: string;
}

export interface TelemetryPayloadBinary {
  latitude: number;
  longitude: number;
  batteryPercent: number;
  solarWatts: number;
  queueLength: number;
}

export class CompactBinaryCodec {
  /**
   * Encodes a MESSAGE packet into compact binary body
   */
  public static encodeMessageBody(data: MessagePayloadBinary): Uint8Array {
    const textBytes = new TextEncoder().encode(data.text);
    const buf = new Uint8Array(8 + 8 + textBytes.length);
    const view = new DataView(buf.buffer);

    // 8 bytes recipient callsign/ID
    const recip = new TextEncoder().encode(data.recipientId.padEnd(8, ' ').slice(0, 8));
    buf.set(recip, 0);

    // 8 bytes timestamp (float64/uint64 approx)
    view.setFloat64(8, data.timestamp, false);

    // N bytes text
    buf.set(textBytes, 16);
    return buf;
  }

  public static decodeMessageBody(buf: Uint8Array): MessagePayloadBinary {
    if (buf.length < 16) throw new Error('Invalid message binary length');
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    const recipStr = new TextDecoder().decode(buf.subarray(0, 8)).trim();
    const timestamp = view.getFloat64(8, false);
    const text = new TextDecoder().decode(buf.subarray(16));

    return { recipientId: recipStr, text, timestamp };
  }

  /**
   * Encodes an SOS packet into compact binary body (Fixed 24 bytes vs ~180+ bytes JSON)
   */
  public static encodeSosBody(data: SosPayloadBinary): Uint8Array {
    const buf = new Uint8Array(24);
    const view = new DataView(buf.buffer);

    view.setFloat32(0, data.latitude, false);
    view.setFloat32(4, data.longitude, false);
    view.setUint8(8, data.batteryPercent);
    view.setUint8(9, data.emergencyCode);

    const callsignBytes = new TextEncoder().encode(data.callsign.padEnd(14, ' ').slice(0, 14));
    buf.set(callsignBytes, 10);

    return buf;
  }

  public static decodeSosBody(buf: Uint8Array): SosPayloadBinary {
    if (buf.length < 24) throw new Error('Invalid SOS binary length');
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    const latitude = Number(view.getFloat32(0, false).toFixed(6));
    const longitude = Number(view.getFloat32(4, false).toFixed(6));
    const batteryPercent = view.getUint8(8);
    const emergencyCode = view.getUint8(9);
    const callsign = new TextDecoder().decode(buf.subarray(10, 24)).trim();

    return { latitude, longitude, batteryPercent, emergencyCode, callsign };
  }

  /**
   * Encodes TELEMETRY into compact binary body (Fixed 18 bytes vs ~150+ bytes JSON)
   */
  public static encodeTelemetryBody(data: TelemetryPayloadBinary): Uint8Array {
    const buf = new Uint8Array(18);
    const view = new DataView(buf.buffer);

    view.setFloat32(0, data.latitude, false);
    view.setFloat32(4, data.longitude, false);
    view.setUint8(8, data.batteryPercent);
    view.setFloat32(9, data.solarWatts, false);
    view.setUint8(13, data.queueLength);

    return buf;
  }

  public static decodeTelemetryBody(buf: Uint8Array): TelemetryPayloadBinary {
    if (buf.length < 18) throw new Error('Invalid telemetry binary length');
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    const latitude = Number(view.getFloat32(0, false).toFixed(6));
    const longitude = Number(view.getFloat32(4, false).toFixed(6));
    const batteryPercent = view.getUint8(8);
    const solarWatts = Number(view.getFloat32(9, false).toFixed(2));
    const queueLength = view.getUint8(13);

    return { latitude, longitude, batteryPercent, solarWatts, queueLength };
  }

  /**
   * Converts binary packet payload into JSON representation for UI / Debug / Export / API
   */
  public static toDebugJson(packet: BinaryPacket): Record<string, any> {
    let bodyObject: any = null;

    try {
      if (packet.header.type === PacketType.DATA) {
        bodyObject = this.decodeMessageBody(packet.payload);
      } else if (packet.header.type === PacketType.SOS_EMERGENCY) {
        bodyObject = this.decodeSosBody(packet.payload);
      } else if (packet.header.type === PacketType.TELEMETRY) {
        bodyObject = this.decodeTelemetryBody(packet.payload);
      } else {
        bodyObject = { rawHex: Array.from(packet.payload).map((b) => b.toString(16).padStart(2, '0')).join('') };
      }
    } catch {
      bodyObject = { rawHex: Array.from(packet.payload).map((b) => b.toString(16).padStart(2, '0')).join('') };
    }

    return {
      rfHeader: packet.header,
      crc: packet.crc,
      payloadSize: packet.payload.length,
      debugData: bodyObject,
      exportedAt: new Date().toISOString(),
    };
  }
}
