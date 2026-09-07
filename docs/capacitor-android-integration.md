# 📱 HÕIMU: Native Android Integration & Sensor Isolation Bypassing

> Converting the HÕIMU Progressive Web App (PWA) into a fully-compiled Native Android Application using **Capacitor**, unlocking raw hardware access to GPS, Bluetooth LE (BLE), and Wi-Fi Scanning (Wardriving) without standard web browser sandboxing constraints.

---

## 🛠️ 1. Why Native Android compilation is essential for HÕIMU

Standard mobile web browsers (Chrome, Safari, Firefox) run in a sandboxed runtime environment that strictly blocks access to critical hardware components needed for offline crisis communication:

1. **Background GPS Tracking**: Browsers freeze execution when the screen is turned off or when the app goes into the background, interrupting pathfinder tracklogs. Native Android compiles background **Foreground Services** that continue polling GPS points.
2. **Wi-Fi Scanning (Wardriving)**: Direct access to the smartphone's raw Wi-Fi network cards (SSID, BSSID, RSSI, channel frequency) is completely blocked in the browser due to fingerprinting and location security concerns.
3. **Bluetooth Low Energy (BLE)**: Browsers restrict BLE scanning to manual, user-initiated prompts, preventing background passive discovery of active physical ESP32 HÕIMU nodes.
4. **Offline Sync Storage Limit**: Browser localStorages cap at ~5MB, whereas native Capacitor apps can access unrestricted local storage pools (SQLite, local filesystem directories) to save heavy topographic map tiles offline.

---

## 🏗️ 2. Step-by-Step Native Android Compilation

To build a standalone `.apk` or `.aab` for Android devices (like the **Xiaomi Mi 9T Pro**), follow these terminal instructions using the pre-configured Capacitor tools.

### 2.1 Preparing the Build Asset Output
Vite must compile the client assets into the static `dist/` distribution folder first:
```bash
npm run build
```

### 2.2 Adding and Synchronizing Android Platforms
Add the Android template structures and mirror the compiled assets inside the native resources directory:
```bash
npx cap add android
npx cap sync
```

### 2.3 Compiling & Running on Emulator / Physical Device
Launch Android Studio to compile the production package, or trigger it directly via CLI:
```bash
npx cap open android
# OR to run immediately on your USB-connected Xiaomi Mi 9T Pro:
npx cap run android
```

---

## 🔐 3. Bypassing Sandboxes: Native Android Permissions

To access high-precision telemetry, you must include the following permissions in your `/android/app/src/main/AndroidManifest.xml` manifest file:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="ee.hoimu.app">

    <!-- Raw GPS Location Permissions for Pathfinder Mapping -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

    <!-- Bluetooth Permissions for ESP32 NeoPixel/Mesh Link Layer -->
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

    <!-- Wi-Fi State Permissions for Wardriving and Mesh Network Identification -->
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:theme="@style/AppTheme">
        
        <!-- Native Location Update Service -->
        <service
            android:name="com.capacitorjs.plugins.geolocation.GeolocationService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="location" />

    </application>
</manifest>
```

---

## 💻 4. Bridge Implementation (`src/services/capacitorBridge.ts`)

We provide a custom wrapper service that dynamically checks whether the user is in a native environment, handles permission negotiations, and requests high-precision background traces.

```typescript
import { CapacitorBridge } from './src/services/capacitorBridge';

// 1. Ask for Android Permissions
const perms = await CapacitorBridge.requestAllPermissions();

if (perms.location) {
  // 2. Start high-precision GPS trace that persists when screen is off
  const watchId = await CapacitorBridge.startBackgroundGps((pos) => {
    console.log(`[Native GPS] Latitude: ${pos.coords.latitude}, Longitude: ${pos.coords.longitude}`);
  });
}

// 3. Scan nearby Wi-Fi APs (Strictly native, fails on standard browsers)
const localSsidAPs = await CapacitorBridge.scanWifiNetworks();
console.log(`Found ${localSsidAPs.length} active Wi-Fi AP beacons.`);
```

---

## 📻 5. ESP32 BLE Telemetry & Mesh Synchronization

To enable bidirectional data communication between the smartphone app and the physical ESP32 HÕIMU node, we utilize BLE notify subscriptions. This enables the ESP32 to push sensor data or incoming mesh packets instantly to the phone, while the phone can request packet broadcasts (flooding).

### 5.1 Communication Protocols & Characteristic UUIDs
- **GATT Service UUID**: `000000ff-0000-1000-8000-00805f9b34fb`
- **RX Characteristic (Write)**: `0000ff01-0000-1000-8000-00805f9b34fb` (Phone -> ESP32)
- **TX Characteristic (Notify)**: `0000ff02-0000-1000-8000-00805f9b34fb` (ESP32 -> Phone)

### 5.2 Listening to Sensor & Mesh Packets in React/Capacitor
```typescript
import { CapacitorBridge } from './src/services/capacitorBridge';

// 1. Establish BLE link & start real-time telemetry/mesh listeners
await CapacitorBridge.startMeshAndSensorSync(
  'ESP32_DEVICE_MAC_OR_ID',
  (sensorData) => {
    console.log(`[ESP32 Sensors] Temp: ${sensorData.temp}°C, Battery: ${sensorData.battery}V`);
  },
  (sender, text) => {
    console.log(`[Incoming Mesh Packet via LoRa] From: ${sender} -> Message: ${text}`);
  }
);

// 2. Dispatch a message from the phone to be flooded over LoRa/ESP-NOW mesh by ESP32
await CapacitorBridge.dispatchMeshMessageOverBle('ESP32_DEVICE_MAC_OR_ID', 'TALLINN_CENTRAL', 'SOS: Water needed at Grid B4');

// 3. Unsubscribe on component unmount
await CapacitorBridge.stopMeshAndSensorSync('ESP32_DEVICE_MAC_OR_ID');
```

### 5.3 ESP32 Arduino C++ Firmware Implementation Blueprint
Upload this sketch to the ESP32 to support JSON packet serialization over the notification channel:

```cpp
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>

#define SERVICE_UUID           "000000ff-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID_RX "0000ff01-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID_TX "0000ff02-0000-1000-8000-00805f9b34fb"

BLEServer* pServer = NULL;
BLECharacteristic* pTxCharacteristic = NULL;
bool deviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };
    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      pServer->getAdvertising()->start(); // Restart advertising
    }
};

class MyRxCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        // Parse incoming mesh transmission request from phone
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, rxValue);
        if (!error) {
          const char* type = doc["type"];
          if (strcmp(type, "mesh_tx") == 0) {
            const char* text = doc["text"];
            const char* sender = doc["sender"];
            // FLOOD OVER PHYSICAL LORA / ESP-NOW INTERFACE HERE
            Serial.printf("[Mesh TX] Broadcasting: %s from %s\n", text, sender);
          }
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  BLEDevice::init("HÕIMU Field Node");

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // TX Characteristic (Notify)
  pTxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_TX,
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
  pTxCharacteristic->addDescriptor(new BLE2902());

  // RX Characteristic (Write)
  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                                           CHARACTERISTIC_UUID_RX,
                                           BLECharacteristic::PROPERTY_WRITE
                                         );
  pRxCharacteristic->setCallbacks(new MyRxCallbacks());

  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("HÕIMU BLE Server Online & Advertising!");
}

void loop() {
  if (deviceConnected) {
    // Collect simulated physical sensor data
    float temp = 22.5 + (random(-10, 10) / 10.0);
    float batteryVoltage = 3.7 + (random(0, 5) / 10.0);

    // Format telemetry payload as a compact JSON packet
    StaticJsonDocument<128> doc;
    doc["type"] = "telemetry";
    doc["temp"] = temp;
    doc["battery"] = batteryVoltage;

    char output[128];
    serializeJson(doc, output);

    // Notify connected phone
    pTxCharacteristic->setValue((uint8_t*)output, strlen(output));
    pTxCharacteristic->notify();

    delay(5000); // Send updates every 5 seconds
  }
}
```
