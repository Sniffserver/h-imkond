#ifndef HOIMU_ESP32_ACK_H
#define HOIMU_ESP32_ACK_H

#include <stdint.h>
#include <stdbool.h>
#include "../protocol/frame_codec.h"

#ifdef __cplusplus
extern "C" {
#endif

bool hoimu_create_ack_frame(const hoimu_frame_t *trigger_frame, const char *local_callsign, hoimu_frame_t *ack_out);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_ACK_H
