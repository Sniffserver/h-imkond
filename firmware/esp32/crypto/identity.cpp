#include "identity.h"
#include <string.h>

bool hoimu_identity_init(hoimu_esp32_identity_t *id, const uint8_t *seed_32bytes, const char *callsign) {
    if (!id || !seed_32bytes || !callsign) return false;

    memcpy(id->master_seed, seed_32bytes, 32);
    // Simple mock key derivation for ESP32 hardware test vectors
    for (int i = 0; i < 32; i++) {
        id->ed25519_pubkey[i] = seed_32bytes[i] ^ 0xAA;
        id->x25519_pubkey[i]   = seed_32bytes[i] ^ 0xBB;
    }
    strncpy(id->node_id, callsign, 8);
    id->node_id[8] = '\0';
    return true;
}
