#ifndef HOIMU_ESP32_COUNTERS_H
#define HOIMU_ESP32_COUNTERS_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint32_t rx_packets;
    uint32_t tx_packets;
    uint32_t crc_errors;
    uint32_t relayed_packets;
    uint32_t airtime_ms_total;
} hoimu_counters_t;

void hoimu_counters_init(void);
void hoimu_counters_inc_rx(void);
void hoimu_counters_inc_tx(uint32_t airtime_ms);
void hoimu_counters_inc_crc_error(void);
void hoimu_counters_inc_relayed(void);
hoimu_counters_t hoimu_counters_get(void);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_COUNTERS_H
