# 💡 HÕIMU: WS2812B / NeoPixel LED Module Hardware & Firmware Integration

> Visual telemetry, notifications, and emergency beacon signaling for the HÕIMU zero-cloud field terminal using an addressable WS2812B NeoPixel strip and an ESP32 microcontroller.

---

## 🔌 1. Electrical & Hardware Specification

The LED system acts as an auxiliary visual feedback board, rendering network diagnostics, SOS beacons, message alerts, and resource matchmaking directly on physical hardware.

### 1.1 Schematic Connection Diagram

```text
ESP32 DevKitC                              WS2812B / NeoPixel Strip
┌──────────────┐                            ┌──────────────────────┐
│       GPIO 5 ├─────────[ 330 Ω ]─────────►│ DIN (Data Input)     │
│              │                            │                      │
│          GND ├────────────────────────────►│ GND                  │
│              │     ┌─────────────────┐    │                      │
│       5V/VCC ├─────┴───[ 1000 µF ]───┴────►│ 5V (VCC)             │
└──────────────┘         Capacitor          └──────────────────────┘
```

### 1.2 Component Details
1. **ESP32 DevKitC**: Evaluates BLE/Serial inputs and runs the store-and-forward light-cycle loop.
2. **WS2812B LED Strip (5V)**: High-brightness RGB with individually addressable pixels.
3. **Resistor (330 Ω)**: Place on the DIN line between ESP32 GPIO 5 and the first pixel to protect the input pin against RF ringing and voltage spikes.
4. **Capacitor (1000 µF, 6.3V or higher)**: Bridge across VCC and GND directly at the LED power terminals to absorb inrush current when LEDs transition to high brightness.

---

## 📡 2. Software Interface API (Serial / BLE)

The HÕIMU web app or native Android app communicates with the ESP32 node via standard JSON payloads over **UART Serial (115200 baud)** or **Bluetooth Low Energy (BLE)**:

### 2.1 API Command Payloads
- **Häire / SOS Warning**: Flashes bright high-frequency terracotta warning pulses.
  ```json
  {"action": "alert", "type": "SOS", "speed_ms": 100}
  ```
- **Uus Sõnum / New Message**: Renders a pulsing bio-regional teal wave (*laine*) traveling down the strip.
  ```json
  {"action": "alert", "type": "MESSAGE", "rgb": [42, 157, 143]}
  ```
- **Uus Matš / Wishlist Match**: Emits a gold-colored warm sparkle (*sädelus*).
  ```json
  {"action": "alert", "type": "MATCH", "rgb": [233, 196, 106]}
  ```
- **Sünkroonimine / Database Sync**: Activates a rotation animation of rotating green pixels.
  ```json
  {"action": "alert", "type": "SYNC", "duration_s": 3}
  ```

---

## 🛠️ 3. Production ESP32 Firmware (Arduino C++)

Save this sketch inside your Arduino IDE or PlatformIO directory to deploy on the ESP32 node.

```cpp
/**
 * HOIMU - WS2812B NeoPixel Field Feedback Controller
 * Resilient Solarpunk Telemetry Visualizer
 * File: hoimu_neopixel.ino
 */

#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>

#define LED_PIN        5     // ESP32 GPIO 5 connected to WS2812B DIN
#define NUM_PIXELS    12     // Adjust to your physical strip/ring count
#define DEFAULT_BRIGHT 45     // Max default brightness (0-255) for power budget

Adafruit_NeoPixel strip(NUM_PIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

// Current visual state
enum LEDMode {
  MODE_IDLE,
  MODE_SOS,
  MODE_MESSAGE,
  MODE_MATCH,
  MODE_SYNC
};

LEDMode currentMode = MODE_IDLE;
unsigned long stateTimer = 0;
unsigned long animationTimer = 0;
int animationStep = 0;
uint8_t alertColorR = 42;
uint8_t alertColorG = 157;
uint8_t alertColorB = 143;

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(DEFAULT_BRIGHT);
  strip.show(); // Turn off all pixels on startup
  
  // Flash Solarpunk Teal to signify ready status
  startupAnimation();
  Serial.println("{\"status\":\"ready\",\"module\":\"hoimu_led_telemetry\"}");
}

void loop() {
  // 1. Listen for serial JSON commands from HÕIMU Web/Android app
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    parseCommand(input);
  }

  // 2. Refresh light-cycle animations based on state timers
  updateAnimations();
}

/**
 * Parses Serial input commands
 */
void parseCommand(String jsonStr) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, jsonStr);
  if (err) {
    Serial.println("{\"status\":\"error\",\"msg\":\"Invalid JSON\"}");
    return;
  }

  const char* action = doc["action"];
  if (strcmp(action, "alert") == 0) {
    const char* type = doc["type"];
    
    if (strcmp(type, "SOS") == 0) {
      currentMode = MODE_SOS;
      stateTimer = millis() + 10000; // Alarm active for 10 seconds
    } 
    else if (strcmp(type, "MESSAGE") == 0) {
      currentMode = MODE_MESSAGE;
      stateTimer = millis() + 4000;  // Blink for 4 seconds
      if (doc.containsKey("rgb")) {
        alertColorR = doc["rgb"][0];
        alertColorG = doc["rgb"][1];
        alertColorB = doc["rgb"][2];
      }
    } 
    else if (strcmp(type, "MATCH") == 0) {
      currentMode = MODE_MATCH;
      stateTimer = millis() + 5000;  // Sparkle for 5 seconds
    }
    else if (strcmp(type, "SYNC") == 0) {
      currentMode = MODE_SYNC;
      stateTimer = doc.containsKey("duration_s") ? millis() + (int)doc["duration_s"] * 1000 : millis() + 3000;
    }
    animationStep = 0;
    Serial.println("{\"status\":\"ok\",\"mode\":\"applied\"}");
  } else if (strcmp(action, "clear") == 0) {
    clearStrip();
    currentMode = MODE_IDLE;
    Serial.println("{\"status\":\"ok\",\"mode\":\"idle\"}");
  }
}

/**
 * Refreshes animations without using blocking delay()
 */
void updateAnimations() {
  // Revert to IDLE if timer expired
  if (currentMode != MODE_IDLE && millis() > stateTimer) {
    clearStrip();
    currentMode = MODE_IDLE;
  }

  unsigned long now = millis();

  switch (currentMode) {
    case MODE_SOS:
      if (now - animationTimer > 100) { // Fast Red Pulse
        animationTimer = now;
        animationStep = !animationStep;
        fillColor(animationStep ? strip.Color(231, 111, 81) : strip.Color(0, 0, 0));
      }
      break;

    case MODE_MESSAGE:
      if (now - animationTimer > 50) { // Traveling wave
        animationTimer = now;
        clearStrip();
        strip.setPixelColor(animationStep % NUM_PIXELS, strip.Color(alertColorR, alertColorG, alertColorB));
        strip.setPixelColor((animationStep + 1) % NUM_PIXELS, strip.Color(alertColorR / 2, alertColorG / 2, alertColorB / 2));
        strip.show();
        animationStep++;
      }
      break;

    case MODE_MATCH:
      if (now - animationTimer > 80) { // Gold sparkles
        animationTimer = now;
        clearStrip();
        for (int i = 0; i < 3; i++) {
          strip.setPixelColor(random(0, NUM_PIXELS), strip.Color(233, 196, 106));
        }
        strip.show();
      }
      break;

    case MODE_SYNC:
      if (now - animationTimer > 60) { // Rotating Green Chaser
        animationTimer = now;
        clearStrip();
        int head = animationStep % NUM_PIXELS;
        strip.setPixelColor(head, strip.Color(135, 168, 120));
        strip.setPixelColor((head + NUM_PIXELS - 1) % NUM_PIXELS, strip.Color(88, 129, 87));
        strip.setPixelColor((head + NUM_PIXELS - 2) % NUM_PIXELS, strip.Color(32, 58, 42));
        strip.show();
        animationStep++;
      }
      break;

    case MODE_IDLE:
    default:
      // Keep off or show faint breathing bioregional green ambient glow
      if (now - animationTimer > 30) {
        animationTimer = now;
        uint8_t breathVal = (sin(now / 1500.0) + 1.0) * 8; // Gentle breathing ambient glow
        fillColor(strip.Color(0, breathVal, breathVal / 2));
      }
      break;
  }
}

void fillColor(uint32_t color) {
  for (int i = 0; i < NUM_PIXELS; i++) {
    strip.setPixelColor(i, color);
  }
  strip.show();
}

void clearStrip() {
  fillColor(strip.Color(0, 0, 0));
}

void startupAnimation() {
  for (int i = 0; i < NUM_PIXELS; i++) {
    strip.setPixelColor(i, strip.Color(42, 157, 143)); // Teal
    strip.show();
    delay(40);
  }
  delay(200);
  clearStrip();
}
```

---

## 🔋 4. Power & Thermal Safety Recommendations

1. **VCC Current Limit**: One WS2812B RGB pixel draws up to **60mA** at full brightness white (`RGB 255, 255, 255`).
   - 12 pixels = **720mA max**.
   - Do NOT run more than 10 LEDs directly from the ESP32 5V pin when powered by a laptop USB port. Use an external battery or limit the maximum software brightness (controlled via `DEFAULT_BRIGHT` or software caps in the code).
2. **LiPo Battery Support**: For portable mobile nodes, run the WS2812B strip directly from a 3.7V / 4.2V LiPo battery. They will work perfectly at slightly lower voltage with reduced power consumption.
