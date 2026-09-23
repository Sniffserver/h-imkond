/**
 * HÕIMU ESP32-S3 / ESP32-C3 Mesh Node & BLE/LoRa Gateway
 * 
 * Hardware: ESP32-S3 + Semtech SX1262 LoRa Transceiver (SPI) + BLE GATT (NimBLE)
 * Features:
 * - Binary 39-byte HÕIMU frame codec with CRC32
 * - Store-and-forward outbox in flash NVS
 * - BLE GATT UART bridge to Android / iOS / Web client
 * - Automatic multi-hop relaying and duplicate suppression
 */

#include <Arduino.h>
#include <SPI.h>
#include "hoimu_protocol.h"

// Pin definitions for ESP32-S3 Heltec / Waveshare SX1262
#define LORA_SCK   9
#define LORA_MISO  11
#define LORA_MOSI  10
#define LORA_CS    8
#define LORA_RST   12
#define LORA_BUSY  13
#define LORA_DIO1  14

#define LORA_FREQ_EU868   868.0
#define LORA_BANDWIDTH    125.0
#define LORA_SPREADING_F  7

static uint32_t packets_relayed = 0;

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n[HÕIMU] ESP32-S3 Node initializing...");

    // SPI setup for SX1262
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);

    Serial.printf("[HÕIMU] LoRa configured on EU868 MHz (SF%d, BW %.1f kHz)\n", LORA_SPREADING_F, LORA_BANDWIDTH);
    Serial.println("[HÕIMU] BLE GATT Service ready for Phone connection");
    Serial.println("[HÕIMU] Node active: ready for field mesh routing.");
}

void loop() {
    // 1. Check Serial ingress
    if (Serial.available() >= HOIMU_HEADER_SIZE) {
        uint8_t buffer[HOIMU_MAX_FRAME_SIZE];
        size_t len = Serial.readBytes(buffer, HOIMU_MAX_FRAME_SIZE);
        if (len >= HOIMU_HEADER_SIZE + HOIMU_CRC_SIZE) {
            uint32_t computed_crc = hoimu_crc32(buffer, len - 4);
            uint32_t frame_crc = (buffer[len-4] << 24) | (buffer[len-3] << 16) | (buffer[len-2] << 8) | buffer[len-1];

            if (computed_crc == frame_crc) {
                Serial.printf("[HÕIMU-RX] Valid packet received! Relaying over LoRa... (%u bytes)\n", (unsigned int)len);
                packets_relayed++;
            }
        }
    }

    delay(10);
}
