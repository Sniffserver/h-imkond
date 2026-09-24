# Identity & Trust Model Specification

## Core Abstraction

All platforms expose the unified `IdentityProvider` interface:

```ts
interface IdentityProvider {
  getNodeId(): Promise<string>;
  getSigningPublicKey(): Promise<Uint8Array>;
  sign(data: Uint8Array): Promise<Uint8Array>;
  getEncryptionPublicKey(): Promise<Uint8Array>;
  establishSession(peer: PeerIdentity): Promise<SessionKey>;
}
```

## Runtime Capability Verification

Hardware backing is strictly validated at runtime:

- `hardwareBackedRequested`: Boolean flag in configuration.
- `hardwareBackedAvailable`: Measured runtime capability (e.g., Android WebCrypto/Keystore API presence).
- `hardwareBackedVerified`: Confirmed cryptographic attestation from hardware enclave / StrongBox / TEE.

## Peer Trust Lifecycle States

`UNKNOWN` -> `PAIRING` -> `VERIFIED` -> `TRUSTED` -> `ROTATED` -> `REVOKED`
