# ADR-005: Local-First Synchronization Invariant

## Status
Accepted

## Context
In disconnected crisis environments, waiting for network confirmation before updating local UI results in frozen user interfaces.

## Decision
Every user mutation MUST succeed locally first in IndexedDB and trigger immediate UI state notifications. Outbox packet serialization and mesh routing happen as background secondary effects.

## Consequences
Guarantees 100% offline responsiveness and zero network block on field user actions.
