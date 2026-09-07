# 🔌 HÕIMU: ESP-IDF Production Firmware Architecture

> Technical specification, comparative analysis, and reference implementation for the HÕIMU field node utilizing the native **Espressif IoT Development Framework (ESP-IDF)** instead of the Arduino wrapper.

---

## 📊 1. Architectural Comparison: ESP-IDF vs. Arduino

While Arduino offers rapid prototyping, its single-threaded abstraction layer introduces significant overhead and scheduling conflicts. For the high-reliability, multi-radio requirements of the **HÕIMU field terminal**, ESP-IDF is the industry-standard choice.

| Feature / Metric | Arduino Core for ESP32 | Native ESP-IDF (FreeRTOS) | HÕIMU Field Implications |
| :--- | :--- | :--- | :--- |
| **Hardware Control** | Limited, high-level wrapper. | Complete, low-level register access. | Fine-grained configuration of SPI / I2C and radio stages. |
| **Concurrent BLE + Wi-Fi**| Unstable; frequent packet drops. | Optimized via dynamic RF coexistence. | Allows simultaneous LoRa SPI polling, BLE beaconing, and Wi-Fi sync. |
| **Memory Allocation** | Fragmented stack; poor control. | Direct DMA, IRAM, and PSRAM tuning. | Crucial for zero-copy packet buffering in larger mesh networks. |
| **Power Management** | Superficial sleep wrappers. | Granular power domains and dynamic DFS. | Deep sleep drops current draw to **<10 µA** (essential for solar nodes). |
| **Scheduler** | Simplistic `loop()` execution. | Native preemptive **FreeRTOS** tasks. | Critical real-time scheduling of sensor polling and packet handling. |
| **Error Recovery** | Global crashes / infinite loops. | Structured Panic handlers & Hardware Watchdogs. | Node auto-recovers from transient faults in isolated outdoor setups. |

---

## 🛠️ 2. WS2812B NeoPixel Driver via ESP-IDF RMT

Using the ESP-IDF **RMT (Remote Control)** peripheral enables cycle-accurate signal generation for WS2812B LEDs *without* blocking the CPU. This allows background pixel animations to run concurrently with radio transmissions.

### Project Setup
1. Create a new ESP-IDF directory:
   ```bash
   idf.py create-project hoimu_firmware
   cd hoimu_firmware
   ```
2. Add the official Espressif `led_strip` dependency:
   ```bash
   idf.py add-dependency "espressif/led_strip"
   ```

### Non-blocking RMT Implementation (`main/main.c`)
```c
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "led_strip.h"
#include "esp_log.h"
#include "esp_err.h"

#define LED_GPIO_PIN 5
#define LED_COUNT 12

static const char *TAG = "hoimu_led_rmt";
static led_strip_handle_t led_strip;

/**
 * Initializes the RMT peripheral as a high-precision NeoPixel driver
 */
void hoimu_led_init(void)
{
    ESP_LOGI(TAG, "Initializing WS2812B LED strip via RMT on GPIO %d", LED_GPIO_PIN);

    led_strip_config_t strip_config = {
        .strip_gpio_num = LED_GPIO_PIN,
        .max_leds = LED_COUNT,
        .led_pixel_format = LED_PIXEL_FORMAT_GRB,
        .led_model = LED_MODEL_WS2812,
        .flags.invert_out = false,
    };

    led_strip_rmt_config_t rmt_config = {
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 10 * 1000 * 1000, // 10 MHz timing clock
        .flags.with_dma = false,
    };

    ESP_ERROR_CHECK(led_strip_new_rmt_device(&strip_config, &rmt_config, &led_strip));
    ESP_ERROR_CHECK(led_strip_clear(led_strip));
}

/**
 * Renders a solid color across the entire strip
 */
void hoimu_led_fill(uint8_t red, uint8_t green, uint8_t blue)
{
    for (int i = 0; i < LED_COUNT; i++) {
        ESP_ERROR_CHECK(led_strip_set_pixel(led_strip, i, red, green, blue));
    }
    ESP_ERROR_CHECK(led_strip_refresh(led_strip));
}

void app_main(void)
{
    hoimu_led_init();

    while (1) {
        // Pulse Solarpunk Teal
        ESP_LOGI(TAG, "Status: Active Mesh. Displaying Ambient Teal.");
        hoimu_led_fill(42, 157, 143);
        vTaskDelay(pdMS_TO_TICKS(1500));

        // Dimmer glow
        hoimu_led_fill(10, 40, 36);
        vTaskDelay(pdMS_TO_TICKS(1500));
    }
}
```

---

## 📡 3. Coexistent BLE Service Registration

HÕIMU uses the Bluetooth Low Energy (BLE) stack to allow passing credentials, mesh parameters, or diagnostic files from local smartphones to the node without active internet connections.

```c
#include "esp_bt.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "esp_bt_main.h"
#include "esp_gatt_common_api.h"
#include "nvs_flash.h"

#define PROFILE_NUM      1
#define PROFILE_APP_ID   0
#define GATTS_SERVICE_UUID_TEST   0x00FF
#define GATTS_CHAR_UUID_TEST      0xFF01

static const char *BLE_TAG = "hoimu_ble";

static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param)
{
    switch (event) {
        case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
            if (param->adv_start_complete.status != ESP_BT_STATUS_SUCCESS) {
                ESP_LOGE(BLE_TAG, "Advertising start failed");
            } else {
                ESP_LOGI(BLE_TAG, "BLE advertising started successfully");
            }
            break;
        default:
            break;
    }
}

void hoimu_ble_init(void)
{
    // Initialize Non-Volatile Storage (NVS) required by Bluetooth
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));

    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_bt_controller_init(&bt_cfg));
    ESP_ERROR_CHECK(esp_bt_controller_enable(ESP_BT_MODE_BLE));

    ESP_ERROR_CHECK(esp_bluedroid_init());
    ESP_ERROR_CHECK(esp_bluedroid_enable());

    ESP_ERROR_CHECK(esp_ble_gap_register_callback(gap_event_handler));
    ESP_LOGI(BLE_TAG, "HÕIMU BLE stack initialized.");
}
```

---

## 🚀 4. Low-Power ESP-NOW Mesh Protocol

For direct node-to-node propagation without joining typical access points, **ESP-NOW** serves as a lightweight, low-overhead link-layer transport protocol capable of executing millisecond-range wakeups.

```c
#include "esp_wifi.h"
#include "esp_now.h"
#include "esp_netif.h"
#include "esp_event.h"

static const char *ESPNOW_TAG = "hoimu_espnow";

// Global Broadcast MAC address
static uint8_t broadcast_mac[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

static void espnow_send_cb(const uint8_t *mac_addr, esp_now_send_status_t status)
{
    if (status == ESP_NOW_SEND_SUCCESS) {
        ESP_LOGI(ESPNOW_TAG, "Packet delivery acknowledged by destination.");
    } else {
        ESP_LOGW(ESPNOW_TAG, "Packet transmission failed.");
    }
}

void hoimu_espnow_init(void)
{
    // Initialize TCP/IP and Wi-Fi subsystem for ESP-NOW (STA Mode)
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_start());

    // Initialize ESP-NOW
    ESP_ERROR_CHECK(esp_now_init());
    ESP_ERROR_CHECK(esp_now_register_send_cb(esp_now_send_cb));

    // Register peer node
    esp_now_peer_info_t peer_info = {0};
    memcpy(peer_info.peer_addr, broadcast_mac, 6);
    peer_info.channel = 0; // Current Wi-Fi channel
    peer_info.encrypt = false;
    ESP_ERROR_CHECK(esp_now_add_peer(&peer_info));

    ESP_LOGI(ESPNOW_TAG, "ESP-NOW transport ready for peer-to-peer telemetry.");
}

void hoimu_espnow_send_telemetry(const char *payload, size_t len)
{
    esp_err_t result = esp_now_send(broadcast_mac, (const uint8_t *)payload, len);
    if (result != ESP_OK) {
        ESP_LOGE(ESPNOW_TAG, "Error sending broadcast: %s", esp_err_to_name(result));
    }
}
```
