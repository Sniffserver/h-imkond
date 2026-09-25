#ifndef HOIMU_ESP32_AIRTIME_H
#define HOIMU_ESP32_AIRTIME_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

uint32_t hoimu_calculate_airtime_ms(size_t payload_bytes, uint8_t sf, float bw_khz);
bool hoimu_check_duty_cycle(uint32_t additional_airtime_ms, uint32_t rolling_hour_airtime_ms, uint32_t limit_ms);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_AIRTIME_H
