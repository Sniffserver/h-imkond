#include "counters.h"
#include <string.h>

static hoimu_counters_t g_counters;

void hoimu_counters_init(void) {
    memset(&g_counters, 0, sizeof(hoimu_counters_t));
}

void hoimu_counters_inc_rx(void) {
    g_counters.rx_packets++;
}

void hoimu_counters_inc_tx(uint32_t airtime_ms) {
    g_counters.tx_packets++;
    g_counters.airtime_ms_total += airtime_ms;
}

void hoimu_counters_inc_crc_error(void) {
    g_counters.crc_errors++;
}

void hoimu_counters_inc_relayed(void) {
    g_counters.relayed_packets++;
}

hoimu_counters_t hoimu_counters_get(void) {
    return g_counters;
}
