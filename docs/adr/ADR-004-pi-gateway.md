# ADR-004: Raspberry Pi Gateway Architecture

## Status
Accepted

## Context
The Pi Gateway acts as an autonomous LoRa-to-IP/BLE bridge in local tactical field hubs.

## Decision
Run a Python daemon (`pi/main.py`) driving an SX1262 SPI driver with hardware Channel Activity Detection (CAD) and standardized JSON telemetry (`pi/telemetry/logger.py`).

## Consequences
Provides robust non-blocking RF carrier sense and structured diagnostic logs.
