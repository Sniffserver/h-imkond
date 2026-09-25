#include "dedup.h"
#include <string.h>

#define DEDUP_CACHE_SIZE 64

static char g_dedup_cache[DEDUP_CACHE_SIZE][9];
static size_t g_dedup_idx = 0;

void hoimu_dedup_init(void) {
    memset(g_dedup_cache, 0, sizeof(g_dedup_cache));
    g_dedup_idx = 0;
}

bool hoimu_dedup_check_and_add(const char *packet_id_8chars) {
    if (!packet_id_8chars) return true;

    for (size_t i = 0; i < DEDUP_CACHE_SIZE; i++) {
        if (strncmp(g_dedup_cache[i], packet_id_8chars, 8) == 0) {
            return true; // Duplicate!
        }
    }

    strncpy(g_dedup_cache[g_dedup_idx], packet_id_8chars, 8);
    g_dedup_cache[g_dedup_idx][8] = '\0';
    g_dedup_idx = (g_dedup_idx + 1) % DEDUP_CACHE_SIZE;

    return false; // New packet
}
