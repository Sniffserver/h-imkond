#ifndef HOIMU_ESP32_OUTBOX_H
#define HOIMU_ESP32_OUTBOX_H

#include <stdint.h>
#include <stdbool.h>
#include "../protocol/frame_codec.h"

#ifdef __cplusplus
extern "C" {
#endif

void hoimu_outbox_init(void);
bool hoimu_outbox_enqueue(const hoimu_frame_t *frame);
bool hoimu_outbox_dequeue(hoimu_frame_t *out_frame);
size_t hoimu_outbox_count(void);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_OUTBOX_H
