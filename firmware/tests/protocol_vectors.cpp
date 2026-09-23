/**
 * HÕIMU Cross-Platform Golden Vector Verification for ESP32 Firmware
 * Tests binary wire layout, 39-byte header alignment, and CRC32 against golden vectors.
 */

#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include <assert.h>
#include "../esp32/hoimu_protocol.h"

// Golden Vector DATA-001 (Hex string)
const char* VECTOR_DATA_001_HEX = 
    "484f494d01010007000000006554414c2d303120202a20202020202020504b54313031202000267b2264617461223a7b2274657874223a2248656c6c6f2054616c6c696e6e206d657368227d7d7c4e7e34";

static uint8_t hex_to_byte(char hi, char lo) {
    auto hex_val = [](char c) -> uint8_t {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return 0;
    };
    return (hex_val(hi) << 4) | hex_val(lo);
}

static size_t parse_hex(const char* hex, uint8_t* buffer, size_t max_len) {
    size_t len = strlen(hex);
    size_t out_len = len / 2;
    if (out_len > max_len) out_len = max_len;
    for (size_t i = 0; i < out_len; i++) {
        buffer[i] = hex_to_byte(hex[i * 2], hex[i * 2 + 1]);
    }
    return out_len;
}

int main() {
    uint8_t buffer[256];
    size_t packet_len = parse_hex(VECTOR_DATA_001_HEX, buffer, sizeof(buffer));

    assert(packet_len >= HOIMU_HEADER_SIZE + HOIMU_CRC_SIZE);
    assert(sizeof(hoimu_header_t) == 39);

    const hoimu_header_t* header = (const hoimu_header_t*)buffer;

    // Check magic bytes (0x484F494D)
    uint32_t magic = ((uint32_t)buffer[0] << 24) | ((uint32_t)buffer[1] << 16) | 
                     ((uint32_t)buffer[2] << 8)  | (uint32_t)buffer[3];
    assert(magic == HOIMU_PROTOCOL_MAGIC);
    assert(header->version == 1);
    assert(header->type == HOIMU_PKT_MESSAGE);
    assert(header->ttl == 7);
    assert(header->hop_count == 0);

    // Verify CRC32
    size_t content_len = packet_len - 4;
    uint32_t calculated_crc = hoimu_crc32(buffer, content_len);

    uint32_t wire_crc = ((uint32_t)buffer[content_len] << 24) |
                        ((uint32_t)buffer[content_len + 1] << 16) |
                        ((uint32_t)buffer[content_len + 2] << 8) |
                        ((uint32_t)buffer[content_len + 3]);

    assert(calculated_crc == wire_crc);

    printf("ESP32 Golden Vector Verification: PASSED (Header size 39, CRC32 matched)\n");
    return 0;
}
