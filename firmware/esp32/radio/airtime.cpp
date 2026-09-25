#include "airtime.h"
#include <math.h>

uint32_t hoimu_calculate_airtime_ms(size_t payload_bytes, uint8_t sf, float bw_khz) {
    if (sf < 7) sf = 7;
    if (sf > 12) sf = 12;
    if (bw_khz <= 0) bw_khz = 125.0;

    float tsym_ms = (float)(1 << sf) / (bw_khz * 1000.0f) * 1000.0f;
    float preamble_ms = 8.0f * tsym_ms;
    float payload_syms = 8.0f + ceilf((8.0f * payload_bytes) / (4.0f * sf)) * 5.0f;
    
    uint32_t total_ms = (uint32_t)(preamble_ms + (payload_syms * tsym_ms));
    return total_ms > 12 ? total_ms : 12;
}

bool hoimu_check_duty_cycle(uint32_t additional_airtime_ms, uint32_t rolling_hour_airtime_ms, uint32_t limit_ms) {
    return (rolling_hour_airtime_ms + additional_airtime_ms) <= limit_ms;
}
