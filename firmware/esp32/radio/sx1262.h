#ifndef HOIMU_ESP32_SX1262_H
#define HOIMU_ESP32_SX1262_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    float frequency_mhz;
    float bandwidth_khz;
    uint8_t spreading_factor;
    uint8_t coding_rate;
    int8_t tx_power_dbm;
    bool active;
} hoimu_sx1262_config_t;

bool hoimu_sx1262_init(hoimu_sx1262_config_t *cfg);
bool hoimu_sx1262_transmit(const uint8_t *buffer, size_t len, uint32_t *airtime_out_ms);
size_t hoimu_sx1262_receive(uint8_t *buffer, size_t max_len, int8_t *rssi_out, int8_t *snr_out);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_SX1262_H
