#include <Arduino.h>
#include <Wire.h>
#include <esp_system.h>

#include "AppState.h"
#include "ControlTask.h"
#include "DeviceConfig.h"
#include "HealthTask.h"
#include "Journal.h"
#include "ModbusFlow.h"
#include "NetworkTask.h"
#include "SensorTask.h"
#include "StorageTask.h"
#include "SyncTask.h"
#include "TimeService.h"
#include "Valve.h"
#include "AppConfig.h"

static void allRelayOff() {
  digitalWrite(RELAY_CH1, RELAY_OFF);
  digitalWrite(RELAY_CH2, RELAY_OFF);
  digitalWrite(RELAY_CH3, RELAY_OFF);
  digitalWrite(RELAY_CH4, RELAY_OFF);
  digitalWrite(RELAY_CH5, RELAY_OFF);
  digitalWrite(RELAY_CH6, RELAY_OFF);
}

static void initRelaysSafe() {
  pinMode(RELAY_CH1, OUTPUT);
  pinMode(RELAY_CH2, OUTPUT);
  pinMode(RELAY_CH3, OUTPUT);
  pinMode(RELAY_CH4, OUTPUT);
  pinMode(RELAY_CH5, OUTPUT);
  pinMode(RELAY_CH6, OUTPUT);
  allRelayOff();
}

static const char* resetReasonText(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON:
      return "POWERON";
    case ESP_RST_SW:
      return "SW";
    case ESP_RST_PANIC:
      return "PANIC";
    case ESP_RST_INT_WDT:
      return "INT_WDT";
    case ESP_RST_TASK_WDT:
      return "TASK_WDT";
    case ESP_RST_WDT:
      return "WDT";
    case ESP_RST_BROWNOUT:
      return "BROWNOUT";
    default:
      return "OTHER";
  }
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  Serial.println();
  Serial.println("[boot] waiting for RS485 / flow meter power-up");
  delay(BOOT_DELAY_MS);

  Serial.println();
  Serial.println("========================================");
  Serial.println(" Smart Flow Meter  PROTOCOL");
  Serial.println(" Waveshare ESP32-S3-Relay-6CH");
  Serial.println("========================================");
  Serial.printf("[boot] reset reason: %s\n",
                resetReasonText(esp_reset_reason()));

  initRelaysSafe();
  Serial.println("[boot] relays off (safe)");

  Wire.begin(RTC_SDA, RTC_SCL);

  if (!AppState_begin()) {
    Serial.println("[boot] AppState failed");
    while (true) {
      delay(1000);
    }
  }

  if (!DeviceConfig_begin()) {
    Serial.println("[boot] DeviceConfig failed");
    while (true) {
      delay(1000);
    }
  }

  char deviceId[MQTT_DEVICE_ID_LEN];
  char clientId[MQTT_CLIENT_ID_LEN];
  AppState_getDeviceId(deviceId, sizeof(deviceId));
  AppState_getClientId(clientId, sizeof(clientId));
  Serial.printf("[boot] deviceId=%s client=%s seq=%lu\n", deviceId, clientId,
                (unsigned long)AppState_peekSequence());

  Valve_begin();
  Valve_apply(DeviceConfig_getValve());
  Serial.printf("[boot] valve restored=%s cause=%s\n",
                ValveState_str(DeviceConfig_getValve()),
                ValveCause_str(DeviceConfig_getValveCause()));

  ModbusFlow_begin();
  Serial.println("[boot] RS485 9600 8N1 TX17 RX18");
  ModbusFlow_purgeBus();
  if (ModbusFlow_warmup()) {
    Serial.println("[boot] Modbus warmup OK");
  } else {
    Serial.println("[boot] Modbus warmup failed, SensorTask will retry");
  }

  if (Journal_begin()) {
    Serial.println("[boot] MicroSD journal OK");
  } else {
    Serial.println("[boot] MicroSD missing, RAM ring fallback");
  }

  TimeService_begin();
  Health_initWdt();

  TaskHandle_t hSensor = nullptr;
  TaskHandle_t hStorage = nullptr;
  TaskHandle_t hNetwork = nullptr;
  TaskHandle_t hControl = nullptr;
  TaskHandle_t hTime = nullptr;
  TaskHandle_t hSync = nullptr;
  TaskHandle_t hHealth = nullptr;

  xTaskCreatePinnedToCore(SensorTask, "sensor", STACK_SENSOR, nullptr,
                          TASK_PRIO_SENSOR, &hSensor, TASK_CORE_SENSOR);
  xTaskCreatePinnedToCore(StorageTask, "storage", STACK_STORAGE, nullptr,
                          TASK_PRIO_STORAGE, &hStorage, TASK_CORE_OTHER);
  xTaskCreatePinnedToCore(ControlTask, "control", STACK_CONTROL, nullptr,
                          TASK_PRIO_CONTROL, &hControl, TASK_CORE_OTHER);
  xTaskCreatePinnedToCore(NetworkTask, "network", STACK_NETWORK, nullptr,
                          TASK_PRIO_NETWORK, &hNetwork, TASK_CORE_OTHER);
  xTaskCreatePinnedToCore(TimeServiceTask, "time", STACK_TIME, nullptr,
                          TASK_PRIO_TIME, &hTime, TASK_CORE_OTHER);
  xTaskCreatePinnedToCore(SyncTask, "sync", STACK_SYNC, nullptr,
                          TASK_PRIO_SYNC, &hSync, TASK_CORE_OTHER);
  xTaskCreatePinnedToCore(HealthTask, "health", STACK_HEALTH, nullptr,
                          TASK_PRIO_HEALTH, &hHealth, TASK_CORE_OTHER);

  (void)hSensor;
  (void)hStorage;
  (void)hNetwork;
  (void)hControl;
  (void)hTime;
  (void)hSync;
  (void)hHealth;

  Serial.println("[boot] tasks started (PROTOCOL MQTT)");
  Serial.printf("[boot] topics under %s/%s/\n", MQTT_TOPIC_PREFIX, deviceId);
}

void loop() {
  delay(1000);
}
