# Storage & Persistence Architecture

## Local-First Canonical Rule

Every user action succeeds locally first. Synchronization is a secondary background effect.

```
User Action -> Local IndexedDB -> UI Notification -> Signed CRDT Event -> Outbox -> Mesh Transport
```

## Persistent Outbox Lifecycle

```
queued -> sending -> sent -> acknowledged
        \-> retrying -> expired / failed
```

Packets persist across app restarts and power loss.
