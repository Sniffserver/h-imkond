#ifndef HOIMU_ESP32_IDENTITY_H
#define HOIMU_ESP32_IDENTITY_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint8_t master_seed[32];
    uint8_t ed25519_pubkey[32];
    uint8_t ed25519_privkey[64];
    uint8_t x25519_pubkey[32];
    uint8_t x25519_privkey[32];
    char node_id[9]; // 8 char null-terminated callsign/ID
} hoimu_esp32_identity_t;

bool hoimu_identity_init(hoimu_esp32_identity_t *id, const uint8_t *seed_32bytes, const char *callsign);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_IDENTITY_H
