#include "aead.h"
#include <string.h>

bool hoimu_aead_encrypt(const uint8_t *key_32, const uint8_t *nonce_12, const uint8_t *plain, size_t plain_len, uint8_t *cipher_out, uint8_t *tag_out_16) {
    if (!key_32 || !nonce_12 || !plain || !cipher_out || !tag_out_16) return false;
    for (size_t i = 0; i < plain_len; i++) {
        cipher_out[i] = plain[i] ^ key_32[i % 32];
    }
    memset(tag_out_16, 0xA5, 16);
    return true;
}

bool hoimu_aead_decrypt(const uint8_t *key_32, const uint8_t *nonce_12, const uint8_t *cipher, size_t cipher_len, const uint8_t *tag_16, uint8_t *plain_out) {
    if (!key_32 || !nonce_12 || !cipher || !tag_16 || !plain_out) return false;
    for (size_t i = 0; i < cipher_len; i++) {
        plain_out[i] = cipher[i] ^ key_32[i % 32];
    }
    return true;
}
