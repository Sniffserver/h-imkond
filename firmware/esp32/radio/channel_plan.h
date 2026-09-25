#ifndef HOIMU_ESP32_CHANNEL_PLAN_H
#define HOIMU_ESP32_CHANNEL_PLAN_H

#define LORA_FREQ_EU868_PRIMARY    868.100 // MHz
#define LORA_FREQ_EU868_SECONDARY  868.300 // MHz
#define LORA_FREQ_EU868_EMERGENCY  869.525 // MHz (10% duty cycle emergency channel)

#define LORA_BW_125_KHZ            125.0
#define LORA_BW_250_KHZ            250.0

#define LORA_SF_FAST               7
#define LORA_SF_DEFAULT            9
#define LORA_SF_LONG_RANGE         12

#define MAX_AIRTIME_MS_PER_HOUR_EU868  36000 // 1% duty cycle = 36s / hr

#endif // HOIMU_ESP32_CHANNEL_PLAN_H
