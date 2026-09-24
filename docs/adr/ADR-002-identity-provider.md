# ADR-002: Unified IdentityProvider Abstraction

## Status
Accepted

## Context
Different platforms (Web, Android, Pi, ESP32) offer varying key protection mechanisms ranging from WebCrypto to Android StrongBox and hardware TPMs.

## Decision
Define a uniform `IdentityProvider` interface and measure hardware backing using explicit runtime fields: `hardwareBackedRequested`, `hardwareBackedAvailable`, `hardwareBackedVerified`.

## Consequences
Clean separation between cryptographic signing/decryption calls and underlying platform security implementations.
