#ifndef HOIMU_ESP32_NVS_H
#define HOIMU_ESP32_NVS_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

bool hoimu_nvs_init(void);
bool hoimu_nvs_write(const char *key, const void *data, size_t len);
bool hoimu_nvs_read(const char *key, void *out_data, size_t max_len, size_t *read_len);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_NVS_H
