#ifndef HOIMU_ESP32_SIGNING_H
#define HOIMU_ESP32_SIGNING_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

bool hoimu_sign_message(const uint8_t *privkey_64, const uint8_t *msg, size_t msg_len, uint8_t *sig_out_64);
bool hoimu_verify_signature(const uint8_t *pubkey_32, const uint8_t *msg, size_t msg_len, const uint8_t *sig_64);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_SIGNING_H
