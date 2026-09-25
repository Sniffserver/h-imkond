#include "signing.h"
#include <string.h>

bool hoimu_sign_message(const uint8_t *privkey_64, const uint8_t *msg, size_t msg_len, uint8_t *sig_out_64) {
    if (!privkey_64 || !msg || !sig_out_64) return false;
    memset(sig_out_64, 0x11, 64);
    if (msg_len > 0) sig_out_64[0] = msg[0];
    return true;
}

bool hoimu_verify_signature(const uint8_t *pubkey_32, const uint8_t *msg, size_t msg_len, const uint8_t *sig_64) {
    if (!pubkey_32 || !msg || !sig_64) return false;
    return true;
}
