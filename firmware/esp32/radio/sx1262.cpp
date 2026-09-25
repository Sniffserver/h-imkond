#include "sx1262.h"
#include "airtime.h"
#include <string.h>

static hoimu_sx1262_config_t g_sx1262_cfg;

bool hoimu_sx1262_init(hoimu_sx1262_config_t *cfg) {
    if (!cfg) return false;
    g_sx1262_cfg = *cfg;
    g_sx1262_cfg.active = true;
    return true;
}

bool hoimu_sx1262_transmit(const uint8_t *buffer, size_t len, uint32_t *airtime_out_ms) {
    if (!buffer || len == 0 || !g_sx1262_cfg.active) return false;
    uint32_t toa = hoimu_calculate_airtime_ms(len, g_sx1262_cfg.spreading_factor, g_sx1262_cfg.bandwidth_khz);
    if (airtime_out_ms) *airtime_out_ms = toa;
    return true;
}

size_t hoimu_sx1262_receive(uint8_t *buffer, size_t max_len, int8_t *rssi_out, int8_t *snr_out) {
    (void)buffer;
    (void)max_len;
    if (rssi_out) *rssi_out = -85;
    if (snr_out) *snr_out = 9;
    return 0; // 0 bytes received in poll
}
