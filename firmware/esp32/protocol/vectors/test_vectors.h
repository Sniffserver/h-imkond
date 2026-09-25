#ifndef HOIMU_TEST_VECTORS_H
#define HOIMU_TEST_VECTORS_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

static const uint8_t HOIMU_VECTOR_TAL1_RAW[] = {
    0x48, 0x4F, 0x49, 0x4D, // "HOIM" magic
    0x01,                   // Version
    0x01,                   // Type (MESSAGE)
    0x00,                   // Flags
    0x05,                   // TTL
    0x00,                   // Hop count
    0x00, 0x00, 0x00, 0x01, // Sequence
    'T','A','L','-','0','1',' ',' ', // Origin ID
    '*',' ',' ',' ',' ',' ',' ',' ', // Destination ID
    'p','k','t','1','2','3','4','5', // Packet ID
    0x00, 0x05,             // Payload length (5 bytes)
    'H','e','l','l','o',    // Payload
    0x88, 0x22, 0x11, 0x00  // Example CRC
};

static const size_t HOIMU_VECTOR_TAL1_LEN = sizeof(HOIMU_VECTOR_TAL1_RAW);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_TEST_VECTORS_H
