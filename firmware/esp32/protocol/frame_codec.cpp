#include "frame_codec.h"
#include <string.h>

bool hoimu_encode_frame(const hoimu_frame_t *frame, uint8_t *out_buf, size_t out_max_len, size_t *out_written_len) {
    size_t total = HOIMU_HEADER_SIZE + frame->payload_len + (frame->has_signature ? 64 : 0) + HOIMU_CRC_SIZE;
    if (out_max_len < total) return false;

    memcpy(out_buf, &frame->header, HOIMU_HEADER_SIZE);
    memcpy(out_buf + HOIMU_HEADER_SIZE, frame->payload, frame->payload_len);
    
    size_t offset = HOIMU_HEADER_SIZE + frame->payload_len;
    if (frame->has_signature) {
        memcpy(out_buf + offset, frame->signature, 64);
        offset += 64;
    }

    uint32_t crc = hoimu_crc32(out_buf, offset);
    out_buf[offset]   = (crc >> 24) & 0xFF;
    out_buf[offset+1] = (crc >> 16) & 0xFF;
    out_buf[offset+2] = (crc >> 8)  & 0xFF;
    out_buf[offset+3] = crc & 0xFF;

    if (out_written_len) *out_written_len = total;
    return true;
}

bool hoimu_decode_frame(const uint8_t *in_buf, size_t in_len, hoimu_frame_t *out_frame) {
    if (in_len < HOIMU_HEADER_SIZE + HOIMU_CRC_SIZE) return false;

    uint32_t calc_crc = hoimu_crc32(in_buf, in_len - 4);
    uint32_t wire_crc = ((uint32_t)in_buf[in_len-4] << 24) |
                         ((uint32_t)in_buf[in_len-3] << 16) |
                         ((uint32_t)in_buf[in_len-2] << 8)  |
                          (uint32_t)in_buf[in_len-1];

    if (calc_crc != wire_crc) return false;

    memcpy(&out_frame->header, in_buf, HOIMU_HEADER_SIZE);
    if (out_frame->header.magic != HOIMU_PROTOCOL_MAGIC) return false;

    size_t body_len = in_len - HOIMU_HEADER_SIZE - HOIMU_CRC_SIZE;
    out_frame->payload_len = body_len;
    out_frame->has_signature = false;

    if (body_len >= 64 && (out_frame->header.flags & HOIMU_FLAG_PRIORITY)) {
        out_frame->payload_len = body_len - 64;
        out_frame->has_signature = true;
        memcpy(out_frame->signature, in_buf + HOIMU_HEADER_SIZE + out_frame->payload_len, 64);
    }

    memcpy(out_frame->payload, in_buf + HOIMU_HEADER_SIZE, out_frame->payload_len);
    out_frame->crc32 = wire_crc;
    return true;
}

bool hoimu_parse_zero_copy(const uint8_t *dma_buf, size_t dma_len, hoimu_zero_copy_view_t *out_view) {
    if (!dma_buf || !out_view || dma_len < HOIMU_HEADER_SIZE + HOIMU_CRC_SIZE) return false;

    uint32_t calc_crc = hoimu_crc32(dma_buf, dma_len - 4);
    uint32_t wire_crc = ((uint32_t)dma_buf[dma_len-4] << 24) |
                         ((uint32_t)dma_buf[dma_len-3] << 16) |
                         ((uint32_t)dma_buf[dma_len-2] << 8)  |
                          (uint32_t)dma_buf[dma_len-1];

    if (calc_crc != wire_crc) return false;

    out_view->header = (const hoimu_header_t *)dma_buf;
    if (out_view->header->magic != HOIMU_PROTOCOL_MAGIC) return false;

    size_t body_len = dma_len - HOIMU_HEADER_SIZE - HOIMU_CRC_SIZE;
    out_view->payload_len = body_len;
    out_view->payload_ptr = dma_buf + HOIMU_HEADER_SIZE;
    out_view->signature_ptr = NULL;
    out_view->has_signature = false;

    if (body_len >= 64 && (out_view->header->flags & HOIMU_FLAG_PRIORITY)) {
        out_view->payload_len = body_len - 64;
        out_view->signature_ptr = dma_buf + HOIMU_HEADER_SIZE + out_view->payload_len;
        out_view->has_signature = true;
    }

    out_view->crc32 = wire_crc;
    return true;
}
