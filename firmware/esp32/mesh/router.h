#ifndef HOIMU_ESP32_ROUTER_H
#define HOIMU_ESP32_ROUTER_H

#include <stdint.h>
#include <stdbool.h>
#include "../protocol/frame_codec.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    HOIMU_ROUTE_DROP,
    HOIMU_ROUTE_DELIVER_LOCAL,
    HOIMU_ROUTE_FORWARD,
    HOIMU_ROUTE_SEND_ACK
} hoimu_route_action_t;

void hoimu_router_init(const char *local_callsign);
hoimu_route_action_t hoimu_router_process_frame(hoimu_frame_t *frame);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_ROUTER_H
