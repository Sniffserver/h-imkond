#include "retry.h"
#include <string.h>

#define MAX_RETRY_ITEMS 16

static hoimu_retry_entry_t g_retry_table[MAX_RETRY_ITEMS];

void hoimu_retry_init(void) {
    memset(g_retry_table, 0, sizeof(g_retry_table));
}

bool hoimu_retry_add(const char *packet_id, uint8_t max_attempts, uint32_t delay_ms) {
    if (!packet_id) return false;

    for (size_t i = 0; i < MAX_RETRY_ITEMS; i++) {
        if (!g_retry_table[i].active) {
            memcpy(g_retry_table[i].packet_id, packet_id, 8);
            g_retry_table[i].attempts = 0;
            g_retry_table[i].max_attempts = max_attempts;
            g_retry_table[i].next_retry_at_ms = delay_ms;
            g_retry_table[i].active = true;
            return true;
        }
    }
    return false;
}

bool hoimu_retry_confirm_ack(const char *packet_id) {
    if (!packet_id) return false;

    for (size_t i = 0; i < MAX_RETRY_ITEMS; i++) {
        if (g_retry_table[i].active && memcmp(g_retry_table[i].packet_id, packet_id, 8) == 0) {
            g_retry_table[i].active = false;
            return true;
        }
    }
    return false;
}
