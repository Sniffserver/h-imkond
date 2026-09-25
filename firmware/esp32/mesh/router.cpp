#include "router.h"
#include "dedup.h"
#include <string.h>

static char g_local_callsign[9] = "ESP32-S3";

void hoimu_router_init(const char *local_callsign) {
    if (local_callsign) {
        strncpy(g_local_callsign, local_callsign, 8);
        g_local_callsign[8] = '\0';
    }
    hoimu_dedup_init();
}

hoimu_route_action_t hoimu_router_process_frame(hoimu_frame_t *frame) {
    if (!frame) return HOIMU_ROUTE_DROP;

    // Check duplicate
    if (hoimu_dedup_check_and_add(frame->header.packet_id)) {
        return HOIMU_ROUTE_DROP;
    }

    // Check TTL
    if (frame->header.ttl == 0) {
        return HOIMU_ROUTE_DROP;
    }
    frame->header.ttl--;
    frame->header.hop_count++;

    // Check local delivery vs broadcast
    if (memcmp(frame->header.destination_id, g_local_callsign, 8) == 0) {
        if (frame->header.flags & HOIMU_FLAG_ACK_REQ) {
            return HOIMU_ROUTE_SEND_ACK;
        }
        return HOIMU_ROUTE_DELIVER_LOCAL;
    }

    if (frame->header.destination_id[0] == '*') {
        return HOIMU_ROUTE_FORWARD;
    }

    return HOIMU_ROUTE_FORWARD;
}
