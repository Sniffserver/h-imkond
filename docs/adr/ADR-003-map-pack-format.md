# ADR-003: PMTiles Map Pack Format & Verification

## Status
Accepted

## Context
Tactical field operations require zero-cloud vector map rendering with high compression and SHA-256 integrity checks.

## Decision
Use single-file `.pmtiles` vector archives backed by IndexedDB and CacheStorage with mandatory SHA-256 verification before atomic activation.

## Consequences
Ensures corrupt or truncated downloads never corrupt map state.
