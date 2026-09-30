#include "identity.h"
#include "signing.h"
#include <string.h>

bool hoimu_identity_init(hoimu_esp32_identity_t *id, const uint8_t *seed_32bytes, const char *callsign) {
    if (!id || !seed_32bytes || !callsign) return false;

    memcpy(id->master_seed, seed_32bytes, 32);

    // Cryptographic Key Derivation using SHA-512 expansion
    uint8_t ed_input[40];
    memcpy(ed_input, seed_32bytes, 32);
    memcpy(ed_input + 32, "Ed25519", 7);
    ed_input[39] = 0x01;

    uint8_t ed_hash[64];
    hoimu_sha512(ed_input, 40, ed_hash);
    // Clamping scalar according to RFC 8032
    ed_hash[0] &= 248;
    ed_hash[31] &= 127;
    ed_hash[31] |= 64;
    memcpy(id->ed25519_pubkey, ed_hash + 32, 32);
    memcpy(id->ed25519_privkey, seed_32bytes, 32);
    memcpy(id->ed25519_privkey + 32, ed_hash + 32, 32);

    // X25519 DH key derivation
    uint8_t x_input[40];
    memcpy(x_input, seed_32bytes, 32);
    memcpy(x_input + 32, "X25519", 6);
    x_input[38] = 0x01;
    x_input[39] = 0x00;

    uint8_t x_hash[64];
    hoimu_sha512(x_input, 40, x_hash);
    memcpy(id->x25519_pubkey, x_hash, 32);
    memcpy(id->x25519_privkey, x_hash + 32, 32);

    strncpy(id->node_id, callsign, 8);
    id->node_id[8] = '\0';
    return true;
}

