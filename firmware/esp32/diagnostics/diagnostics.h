#ifndef HOIMU_ESP32_DIAGNOSTICS_H
#define HOIMU_ESP32_DIAGNOSTICS_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint32_t free_heap_bytes;
    uint32_t uptime_seconds;
    int8_t last_rssi;
    int8_t last_snr;
    uint8_t battery_percent;
} hoimu_diagnostics_report_t;

hoimu_diagnostics_report_t hoimu_diagnostics_get_report(void);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_DIAGNOSTICS_H
