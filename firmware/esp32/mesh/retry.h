#ifndef HOIMU_ESP32_RETRY_H
#define HOIMU_ESP32_RETRY_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char packet_id[8];
    uint8_t attempts;
    uint8_t max_attempts;
    uint32_t next_retry_at_ms;
    bool active;
} hoimu_retry_entry_t;

void hoimu_retry_init(void);
bool hoimu_retry_add(const char *packet_id, uint8_t max_attempts, uint32_t delay_ms);
bool hoimu_retry_confirm_ack(const char *packet_id);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_RETRY_H
