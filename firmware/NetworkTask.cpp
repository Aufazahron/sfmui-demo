#include "NetworkTask.h"

#include <PubSubClient.h>
#include <WiFi.h>
#include <atomic>
#include <esp_task_wdt.h>
#include <stdlib.h>
#include <string.h>

#include "AppConfig.h"
#include "AppState.h"
#include "ControlTask.h"
#include "DeviceConfig.h"
#include "ProtoUtil.h"

static WiFiClient s_wifi;
static PubSubClient s_mqtt(s_wifi);
static SemaphoreHandle_t s_mqttMutex = nullptr;
static uint32_t s_backoffMs = MQTT_BACKOFF_MIN_MS;
static uint32_t s_lastHeartbeatMs = 0;
static uint32_t s_bootMs = 0;
static char s_clientId[MQTT_CLIENT_ID_LEN];
static char s_topicLwt[MQTT_TOPIC_LEN];
static bool s_needReconcile = false;
static std::atomic<bool> s_configAckFlag{false};

void Network_notifyConfigApplied() { s_configAckFlag.store(true); }

static bool consumeConfigAckFlag() { return s_configAckFlag.exchange(false); }

static bool mqttLocked() {
  return xSemaphoreTake(s_mqttMutex, pdMS_TO_TICKS(80)) == pdTRUE;
}

static void mqttUnlock() { xSemaphoreGive(s_mqttMutex); }

static bool wifiConfigured() {
  return WIFI_SSID[0] != '\0' && strcmp(WIFI_SSID, "YOUR_SSID") != 0;
}

static void delayWithWdt(uint32_t ms) {
  const uint32_t start = millis();
  while ((millis() - start) < ms) {
    esp_task_wdt_reset();
    AppState_noteHeartbeat(HB_NETWORK);
    vTaskDelay(pdMS_TO_TICKS(200));
  }
}

static bool endsWith(const char* topic, const char* suffix) {
  const size_t lt = strlen(topic);
  const size_t ls = strlen(suffix);
  if (ls > lt) {
    return false;
  }
  return strcmp(topic + (lt - ls), suffix) == 0;
}

static bool extractString(const char* json, const char* key, char* out,
                          size_t outLen) {
  char pattern[48];
  snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  const char* p = strstr(json, pattern);
  if (!p) {
    return false;
  }
  p = strchr(p + strlen(pattern), ':');
  if (!p) {
    return false;
  }
  p++;
  while (*p == ' ' || *p == '\t') {
    p++;
  }
  if (*p == 'n' && strncmp(p, "null", 4) == 0) {
    out[0] = 0;
    return true;
  }
  if (*p != '\"') {
    return false;
  }
  p++;
  size_t i = 0;
  while (*p && *p != '\"' && i + 1 < outLen) {
    out[i++] = *p++;
  }
  out[i] = 0;
  return true;
}

static void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  char* buf = (char*)malloc(length + 1);
  if (!buf) {
    return;
  }
  memcpy(buf, payload, length);
  buf[length] = 0;

  if (endsWith(topic, "command/valve")) {
    char valve[16] = "";
    char cmdId[40] = "";
    extractString(buf, "valve", valve, sizeof(valve));
    extractString(buf, "command_id", cmdId, sizeof(cmdId));
    ControlMsg msg = {};
    msg.type = CTRL_VALVE;
    msg.valve = (strcmp(valve, "open") == 0) ? VALVE_OPEN : VALVE_CLOSED;
    strncpy(msg.command_id, cmdId, sizeof(msg.command_id) - 1);
    AppState_postControl(&msg);
  } else if (endsWith(topic, "command/config") &&
             !endsWith(topic, "command/config/ack")) {
    if (DeviceConfig_applyJson(buf, length)) {
      Network_notifyConfigApplied();
      ControlMsg msg = {};
      msg.type = CTRL_CONFIG_APPLIED;
      AppState_postControl(&msg);
    }
  } else if (endsWith(topic, "command/dev")) {
    char action[24] = "";
    extractString(buf, "action", action, sizeof(action));
    const char* en = strstr(buf, "\"enable\"");
    bool enable = false;
    if (en) {
      if (strstr(en, "true") &&
          (!strstr(en, "false") || strstr(en, "true") < strstr(en, "false"))) {
        enable = true;
      }
    }
    if (strcmp(action, "hybrid_ap") == 0 && enable) {
      ControlMsg msg = {};
      msg.type = CTRL_DEV_HYBRID_AP;
      AppState_postControl(&msg);
    }
  } else if (endsWith(topic, "sync/state")) {
    ControlMsg msg = {};
    msg.type = CTRL_SYNC_STATE;
    if (!extractString(buf, "last_recorded_at", msg.last_recorded_at,
                       sizeof(msg.last_recorded_at))) {
      msg.last_recorded_at[0] = 0;
    }
    AppState_postControl(&msg);
    if (DeviceConfig_applyJson(buf, length)) {
      Network_notifyConfigApplied();
      ControlMsg cfg = {};
      cfg.type = CTRL_CONFIG_APPLIED;
      AppState_postControl(&cfg);
    }
  }

  free(buf);
}

bool NetworkTask_mqttReady() {
  return WiFi.status() == WL_CONNECTED && s_mqtt.connected();
}

bool NetworkTask_publishJson(const char* suffix, const char* payload,
                             bool retain, int qos) {
  if (!NetworkTask_mqttReady() || !suffix || !payload) {
    return false;
  }
  char topic[MQTT_TOPIC_LEN];
  AppState_topic(topic, sizeof(topic), suffix);
  bool ok = false;
  if (mqttLocked()) {
    ok = s_mqtt.publish(topic, (const uint8_t*)payload, (unsigned int)strlen(payload),
                        retain);
    (void)qos;
    mqttUnlock();
  }
  return ok;
}

static void publishValveStatus() {
  char ts[32];
  TimeCache tc;
  AppState_readTimeCache(&tc);
  uint32_t unixUtc = tc.unix_time;
  if (unixUtc) {
    unixUtc += (millis() - tc.millis_at_update) / 1000;
  }
  Proto_formatIsoUtc(ts, sizeof(ts), unixUtc ? unixUtc : TIME_VALID_UNIX_MIN);
  char payload[160];
  snprintf(payload, sizeof(payload),
           "{\"ts\":\"%s\",\"valve\":\"%s\",\"cause\":\"%s\"}", ts,
           ValveState_str(DeviceConfig_getValve()),
           ValveCause_str(DeviceConfig_getValveCause()));
  NetworkTask_publishJson("status/valve", payload, true, 1);
}

static void publishOnline() {
  NetworkTask_publishJson("status/lwt", "{\"status\":\"online\"}", true, 1);
}

static void publishHeartbeat() {
  DeviceConfigSnapshot cfg;
  DeviceConfig_get(&cfg);
  char ts[32];
  TimeCache tc;
  AppState_readTimeCache(&tc);
  uint32_t unixUtc = tc.unix_time;
  if (unixUtc) {
    unixUtc += (millis() - tc.millis_at_update) / 1000;
  }
  Proto_formatIsoUtc(ts, sizeof(ts), unixUtc ? unixUtc : TIME_VALID_UNIX_MIN);
  const uint32_t uptime = (millis() - s_bootMs) / 1000;
  char payload[160];
  snprintf(payload, sizeof(payload),
           "{\"ts\":\"%s\",\"uptime_s\":%lu,\"config_version\":%lu}", ts,
           (unsigned long)uptime, (unsigned long)cfg.config_version);
  NetworkTask_publishJson("status/heartbeat", payload, false, 0);
}

static void publishConfigAck() {
  DeviceConfigSnapshot cfg;
  DeviceConfig_get(&cfg);
  char ts[32];
  TimeCache tc;
  AppState_readTimeCache(&tc);
  uint32_t unixUtc = tc.unix_time;
  if (unixUtc) {
    unixUtc += (millis() - tc.millis_at_update) / 1000;
  }
  Proto_formatIsoUtc(ts, sizeof(ts), unixUtc ? unixUtc : TIME_VALID_UNIX_MIN);
  char payload[128];
  snprintf(payload, sizeof(payload), "{\"ts\":\"%s\",\"config_version\":%lu}",
           ts, (unsigned long)cfg.config_version);
  NetworkTask_publishJson("command/config/ack", payload, false, 1);
}

static void publishLive(const SensorRecord* rec) {
  char ts[32];
  Proto_formatIsoUtc(ts, sizeof(ts), rec->unix_time);
  const float flow = rec->flow_raw / FLOW_RAW_DIVISOR;
  const float odo = rec->volume_raw / VOLUME_RAW_DIVISOR;
  char payload[192];
  snprintf(payload, sizeof(payload),
           "{\"ts\":\"%s\",\"flowrate\":%.2f,\"odometer\":%.2f}", ts, flow,
           odo);
  NetworkTask_publishJson("telemetry/live", payload, false, 0);
}

bool NetworkTask_publishRecord(const SensorRecord* rec, bool backlog) {
  if (!rec) {
    return false;
  }
  char recordedAt[32];
  Proto_formatIsoUtc(recordedAt, sizeof(recordedAt), rec->unix_time);
  const float flow = rec->flow_raw / FLOW_RAW_DIVISOR;
  const float odo = rec->volume_raw / VOLUME_RAW_DIVISOR;

  if (!backlog) {
    char payload[220];
    snprintf(payload, sizeof(payload),
             "{\"seq\":%lu,\"recorded_at\":\"%s\",\"flowrate_avg\":%.2f,"
             "\"odometer\":%.2f}",
             (unsigned long)rec->sequence, recordedAt, flow, odo);
    return NetworkTask_publishJson("telemetry/minute", payload, false, 1);
  }

  char payload[280];
  snprintf(payload, sizeof(payload),
           "{\"from_seq\":%lu,\"to_seq\":%lu,\"readings\":[{\"seq\":%lu,"
           "\"recorded_at\":\"%s\",\"flowrate_avg\":%.2f,\"odometer\":%.2f}]}",
           (unsigned long)rec->sequence, (unsigned long)rec->sequence,
           (unsigned long)rec->sequence, recordedAt, flow, odo);
  return NetworkTask_publishJson("telemetry/backlog", payload, false, 1);
}

static bool ensureWifi() {
  if (!wifiConfigured()) {
    AppState_setWifiOk(false);
    AppState_setMqttOk(false);
    delayWithWdt(1000);
    return false;
  }
  if (WiFi.status() == WL_CONNECTED) {
    AppState_setWifiOk(true);
    return true;
  }
  AppState_setWifiOk(false);
  AppState_setMqttOk(false);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED &&
         (millis() - start) < WIFI_CONNECT_WAIT_MS) {
    esp_task_wdt_reset();
    AppState_noteHeartbeat(HB_NETWORK);
    vTaskDelay(pdMS_TO_TICKS(WIFI_CONNECT_SLICE_MS));
  }
  const bool ok = WiFi.status() == WL_CONNECTED;
  AppState_setWifiOk(ok);
  if (!ok) {
    WiFi.disconnect(true);
    delayWithWdt(s_backoffMs);
    if (s_backoffMs < MQTT_BACKOFF_MAX_MS) {
      s_backoffMs *= 2;
      if (s_backoffMs > MQTT_BACKOFF_MAX_MS) {
        s_backoffMs = MQTT_BACKOFF_MAX_MS;
      }
    }
  }
  return ok;
}

static bool ensureMqtt() {
  if (s_mqtt.connected()) {
    AppState_setMqttOk(true);
    return true;
  }
  AppState_setMqttOk(false);
  AppState_countReconnect();

  AppState_topic(s_topicLwt, sizeof(s_topicLwt), "status/lwt");
  const char* lwtPayload = "{\"status\":\"offline\"}";

  bool ok = false;
  if (mqttLocked()) {
    if (MQTT_USER[0] == '\0') {
      ok = s_mqtt.connect(s_clientId, s_topicLwt, 1, true, lwtPayload);
    } else {
      ok = s_mqtt.connect(s_clientId, MQTT_USER, MQTT_PASS, s_topicLwt, 1, true,
                          lwtPayload);
    }
    if (ok) {
      char t[MQTT_TOPIC_LEN];
      AppState_topic(t, sizeof(t), "command/valve");
      s_mqtt.subscribe(t, 1);
      AppState_topic(t, sizeof(t), "command/config");
      s_mqtt.subscribe(t, 1);
      AppState_topic(t, sizeof(t), "command/dev");
      s_mqtt.subscribe(t, 1);
      AppState_topic(t, sizeof(t), "sync/state");
      s_mqtt.subscribe(t, 1);
    }
    mqttUnlock();
  }

  if (ok) {
    AppState_setMqttOk(true);
    s_backoffMs = MQTT_BACKOFF_MIN_MS;
    s_needReconcile = true;
    ControlMsg msg = {};
    msg.type = CTRL_MQTT_RECONNECTED;
    AppState_postControl(&msg);
    return true;
  }

  delayWithWdt(s_backoffMs);
  if (s_backoffMs < MQTT_BACKOFF_MAX_MS) {
    s_backoffMs *= 2;
    if (s_backoffMs > MQTT_BACKOFF_MAX_MS) {
      s_backoffMs = MQTT_BACKOFF_MAX_MS;
    }
  }
  return false;
}

static void onReconcile() {
  publishOnline();
  publishValveStatus();
  publishConfigAck();
  s_needReconcile = false;
}

void NetworkTask(void* arg) {
  (void)arg;
  esp_task_wdt_add(nullptr);
  s_bootMs = millis();
  s_mqttMutex = xSemaphoreCreateMutex();
  AppState_getClientId(s_clientId, sizeof(s_clientId));

  s_mqtt.setServer(MQTT_HOST, MQTT_PORT);
  s_mqtt.setCallback(onMqttMessage);
  s_mqtt.setKeepAlive(MQTT_KEEPALIVE_SEC);
  s_mqtt.setBufferSize(1024);

  for (;;) {
    AppState_noteHeartbeat(HB_NETWORK);
    esp_task_wdt_reset();

    if (!ensureWifi()) {
      continue;
    }
    if (!ensureMqtt()) {
      continue;
    }

    if (mqttLocked()) {
      s_mqtt.loop();
      mqttUnlock();
    }

    if (s_needReconcile) {
      onReconcile();
    }

    if (Control_takePublishValveRequest()) {
      publishValveStatus();
    }

    if (consumeConfigAckFlag()) {
      publishConfigAck();
    }

    SensorRecord live;
    if (xQueueReceive(AppState_realtimeMailbox(), &live, 0) == pdTRUE) {
      if (live.status == RECORD_OK) {
        publishLive(&live);
      }
    }

    SensorRecord minute;
    if (xQueueReceive(AppState_minuteMailbox(), &minute, 0) == pdTRUE) {
      NetworkTask_publishRecord(&minute, false);
    }

    uint8_t drained = 0;
    while (drained < 3 && AppState_ramRingPop(&minute)) {
      NetworkTask_publishRecord(&minute, true);
      drained++;
    }

    if ((millis() - s_lastHeartbeatMs) >= MQTT_HEALTH_PERIOD_MS) {
      publishHeartbeat();
      s_lastHeartbeatMs = millis();
    }

    vTaskDelay(pdMS_TO_TICKS(20));
  }
}
