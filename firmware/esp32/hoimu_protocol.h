/**
 * HÕIMU Protocol Header for ESP32-S3 / ESP32-C3 Firmware
 * Compatible with HÕIMU TypeScript and Python Codecs (CRC32, 39-byte header).
 */

#ifndef HOIMU_PROTOCOL_H
#define HOIMU_PROTOCOL_H

#include <stdint.h>
#include <stdbool.h>

#define HOIMU_PROTOCOL_MAGIC   0x484F494D  // "HOIM" in ASCII
#define HOIMU_PROTOCOL_VERSION 1
#define HOIMU_MAX_FRAME_SIZE   255
#define HOIMU_HEADER_SIZE      39
#define HOIMU_CRC_SIZE         4

typedef enum {
    HOIMU_PKT_MESSAGE         = 0x01,
    HOIMU_PKT_DIRECT_ENCRYPT  = 0x02,
    HOIMU_PKT_SOS             = 0x03,
    HOIMU_PKT_CRDT_SYNC       = 0x04,
    HOIMU_PKT_ROUTE_ANNOUNCE  = 0x05,
    HOIMU_PKT_ACK             = 0x06
} hoimu_packet_type_t;

typedef enum {
    HOIMU_FLAG_NONE           = 0x00,
    HOIMU_FLAG_ENCRYPTED      = 0x01,
    HOIMU_FLAG_PRIORITY       = 0x02,
    HOIMU_FLAG_ACK_REQ        = 0x04,
    HOIMU_FLAG_COMPRESSED     = 0x08
} hoimu_packet_flags_t;

#pragma pack(push, 1)
typedef struct {
    uint32_t magic;           // 0x484F494D Big-Endian
    uint8_t  version;         // 1
    uint8_t  type;            // hoimu_packet_type_t
    uint8_t  flags;           // hoimu_packet_flags_t
    uint8_t  ttl;             // Remaining hops
    uint8_t  hop_count;       // Hops traveled
    uint32_t sequence;        // Big-Endian uint32
    char     origin_id[8];    // 8-byte ASCII Call/ID (space padded)
    char     destination_id[8];// 8-byte ASCII Call/ID (space padded, '*' for bcast)
    char     packet_id[8];    // 8-byte ASCII unique packet hash
    uint16_t payload_length;  // Big-Endian uint16
} hoimu_header_t;
#pragma pack(pop)

#ifdef __cplusplus
extern "C" {
#endif

// Fast IEEE 802.3 CRC32 Implementation
static inline uint32_t hoimu_crc32(const uint8_t *data, size_t length) {
    uint32_t crc = 0xFFFFFFFF;
    for (size_t i = 0; i < length; i++) {
        crc ^= data[i];
        for (uint8_t j = 0; j < 8; j++) {
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));
        }
    }
    return ~crc;
}

#ifdef __cplusplus
}
#endif

#endif // HOIMU_PROTOCOL_H
