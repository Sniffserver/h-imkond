# HÕIMU Threat Model & Security Architecture

## Threat Model & Mitigations
- **Malicious Peer**: Ed25519 payload signatures + peer trust revocation (`PeerTrustStore`).
- **Compromised Pi**: Session key expiration & capability token verification.
- **Replay Attacks**: Nonce & timestamp window enforcement (600s max clock skew).
- **Packet Injection**: CRC32 framing + authenticated XChaCha20-Poly1305 payload encryption.
- **Stolen Device**: Hardware Keystore / StrongBox backed key protection.
