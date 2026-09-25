#ifndef HOIMU_ESP32_CAD_H
#define HOIMU_ESP32_CAD_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

bool hoimu_perform_cad_lbt(uint16_t timeout_ms);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_CAD_H
