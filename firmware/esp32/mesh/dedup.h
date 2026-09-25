#ifndef HOIMU_ESP32_DEDUP_H
#define HOIMU_ESP32_DEDUP_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

void hoimu_dedup_init(void);
bool hoimu_dedup_check_and_add(const char *packet_id_8chars);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_DEDUP_H
