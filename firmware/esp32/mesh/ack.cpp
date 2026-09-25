#include "ack.h"
#include <string.h>

bool hoimu_create_ack_frame(const hoimu_frame_t *trigger_frame, const char *local_callsign, hoimu_frame_t *ack_out) {
    if (!trigger_frame || !local_callsign || !ack_out) return false;

    memset(ack_out, 0, sizeof(hoimu_frame_t));
    ack_out->header.magic = HOIMU_PROTOCOL_MAGIC;
    ack_out->header.version = HOIMU_PROTOCOL_VERSION;
    ack_out->header.type = HOIMU_PKT_ACK;
    ack_out->header.ttl = 5;
    ack_out->header.sequence = trigger_frame->header.sequence;

    strncpy(ack_out->header.origin_id, local_callsign, 8);
    memcpy(ack_out->header.destination_id, trigger_frame->header.origin_id, 8);
    memcpy(ack_out->header.packet_id, trigger_frame->header.packet_id, 8);

    ack_out->payload_len = 0;
    ack_out->has_signature = false;
    return true;
}
