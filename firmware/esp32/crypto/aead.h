#ifndef HOIMU_ESP32_AEAD_H
#define HOIMU_ESP32_AEAD_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

bool hoimu_aead_encrypt(const uint8_t *key_32, const uint8_t *nonce_12, const uint8_t *plain, size_t plain_len, uint8_t *cipher_out, uint8_t *tag_out_16);
bool hoimu_aead_decrypt(const uint8_t *key_32, const uint8_t *nonce_12, const uint8_t *cipher, size_t cipher_len, const uint8_t *tag_16, uint8_t *plain_out);

#ifdef __cplusplus
}
#endif

#endif // HOIMU_ESP32_AEAD_H
