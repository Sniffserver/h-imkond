#ifndef HOIMU_FRAME_CODEC_H
#define HOIMU_FRAME_CODEC_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include "../hoimu_protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    hoimu_header_t header;
    uint8_t payload[212];
    size_t payload_len;
    uint8_t signature[64];
    bool has_signature;
    uint32_t crc32;
} hoimu_frame_t;

typedef struct {
    const hoimu_header_t *header;
    const uint8_t *payload_ptr;
    size_t payload_len;
    const uint8_t *signature_ptr;
    bool has_signature;
    uint32_t crc32;
} hoimu_zero_copy_view_t;

bool hoimu_encode_frame(const hoimu_frame_t *frame, uint8_t *out_buf, size_t out_max_len, size_t *out_written_len);
bool hoimu_decode_frame(const uint8_t *in_buf, size_t in_len, hoimu_frame_t *out_frame);
bool hoimu_parse_zero_copy(const uint8_t *dma_buf, size_t dma_len, hoimu_zero_copy_view_t *out_view);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_FRAME_CODEC_H
