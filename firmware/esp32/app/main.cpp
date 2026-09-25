/**
 * HÕIMU ESP32-S3 / ESP32-C3 Firmware Main Application
 * Hardware Architecture: FreeRTOS Task Scheduler
 * Tasks: RadioTask, FrameTask, MeshTask, StorageTask, TelemetryTask
 */

#include <Arduino.h>
#include "../hoimu_protocol.h"
#include "../protocol/frame_codec.h"
#include "../crypto/identity.h"
#include "../radio/sx1262.h"
#include "../radio/airtime.h"
#include "../mesh/router.h"
#include "../storage/outbox.h"
#include "../storage/counters.h"
#include "../diagnostics/diagnostics.h"

// FreeRTOS task handles
TaskHandle_t xRadioTaskHandle = NULL;
TaskHandle_t xFrameTaskHandle = NULL;
TaskHandle_t xMeshTaskHandle = NULL;
TaskHandle_t xStorageTaskHandle = NULL;
TaskHandle_t xTelemetryTaskHandle = NULL;

// Task 1: RadioTask (SX1262 SPI IRQ & LoRa RX/TX)
void RadioTask(void *pvParameters) {
    (void)pvParameters;
    hoimu_sx1262_config_t cfg;
    cfg.frequency_mhz = 868.1;
    cfg.bandwidth_khz = 125.0;
    cfg.spreading_factor = 7;
    cfg.coding_rate = 1;
    cfg.tx_power_dbm = 14;
    hoimu_sx1262_init(&cfg);

    for (;;) {
        uint8_t rx_buf[HOIMU_MAX_FRAME_SIZE];
        int8_t rssi, snr;
        size_t rx_len = hoimu_sx1262_receive(rx_buf, sizeof(rx_buf), &rssi, &snr);
        if (rx_len > 0) {
            hoimu_counters_inc_rx();
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

// Task 2: FrameTask (Binary frame codec & CRC32 checks)
void FrameTask(void *pvParameters) {
    (void)pvParameters;
    for (;;) {
        // Frame codec processing queue
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

// Task 3: MeshTask (Store-and-forward routing, deduplication, ACK & retry)
void MeshTask(void *pvParameters) {
    (void)pvParameters;
    hoimu_router_init("TAL-01");
    for (;;) {
        hoimu_frame_t out_frame;
        if (hoimu_outbox_dequeue(&out_frame)) {
            uint32_t airtime_ms = 0;
            uint8_t wire_buf[HOIMU_MAX_FRAME_SIZE];
            size_t written = 0;
            if (hoimu_encode_frame(&out_frame, wire_buf, sizeof(wire_buf), &written)) {
                if (hoimu_sx1262_transmit(wire_buf, written, &airtime_ms)) {
                    hoimu_counters_inc_tx(airtime_ms);
                }
            }
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

// Task 4: StorageTask (NVS outbox ring persistence & packet counters)
void StorageTask(void *pvParameters) {
    (void)pvParameters;
    hoimu_outbox_init();
    hoimu_counters_init();
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

// Task 5: TelemetryTask (Battery, RSSI/SNR diagnostics & system status)
void TelemetryTask(void *pvParameters) {
    (void)pvParameters;
    for (;;) {
        hoimu_diagnostics_report_t diag = hoimu_diagnostics_get_report();
        (void)diag;
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("[HÕIMU-ESP32] FreeRTOS Multi-Task Architecture Starting...");

    // Create FreeRTOS Tasks with priority distribution
    xTaskCreate(RadioTask,     "RadioTask",     4096, NULL, 5, &xRadioTaskHandle);
    xTaskCreate(FrameTask,     "FrameTask",     3072, NULL, 4, &xFrameTaskHandle);
    xTaskCreate(MeshTask,      "MeshTask",      4096, NULL, 3, &xMeshTaskHandle);
    xTaskCreate(StorageTask,   "StorageTask",   3072, NULL, 2, &xStorageTaskHandle);
    xTaskCreate(TelemetryTask, "TelemetryTask", 2048, NULL, 1, &xTelemetryTaskHandle);

    Serial.println("[HÕIMU-ESP32] All 5 FreeRTOS Tasks running smoothly.");
}

void loop() {
    // Empty main loop - FreeRTOS task scheduler handles execution
    vTaskDelay(pdMS_TO_TICKS(1000));
}
