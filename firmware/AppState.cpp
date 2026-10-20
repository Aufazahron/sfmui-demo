#include "AppState.h"

#include <Preferences.h>
#include <atomic>
#include <string.h>

#include "AppConfig.h"

static QueueHandle_t s_sensorQueue = nullptr;
static QueueHandle_t s_realtimeMailbox = nullptr;
static QueueHandle_t s_minuteMailbox = nullptr;
static QueueHandle_t s_controlQueue = nullptr;
static SemaphoreHandle_t s_timeMutex = nullptr;
static SemaphoreHandle_t s_sdMutex = nullptr;
static SemaphoreHandle_t s_metaMutex = nullptr;
static SemaphoreHandle_t s_ringMutex = nullptr;

static TimeCache s_timeCache = {};
static Preferences s_prefs;

static std::atomic<uint32_t> s_sequence{0};
static std::atomic<uint32_t> s_lastAck{0};
static std::atomic<uint32_t> s_modbusTimeouts{0};
static std::atomic<uint32_t> s_modbusBadFrames{0};
static std::atomic<uint32_t> s_queueDrops{0};
static std::atomic<uint32_t> s_reconnects{0};
static std::atomic<uint32_t> s_backlog{0};
static std::atomic<uint16_t> s_queueWatermark{0};
static std::atomic<bool> s_sdOk{false};
static std::atomic<bool> s_wifiOk{false};
static std::atomic<bool> s_mqttOk{false};
static std::atomic<bool> s_rtcOk{false};
static std::atomic<bool> s_ntpOk{false};
static std::atomic<bool> s_modbusOk{false};

static volatile uint32_t s_heartbeatMs[7] = {0, 0, 0, 0, 0, 0, 0};

static SensorRecord s_ramRing[RAM_RING_LEN];
static uint16_t s_ringHead = 0;
static uint16_t s_ringTail = 0;
static uint16_t s_ringCount = 0;

static char s_deviceId[MQTT_DEVICE_ID_LEN];
static char s_clientId[MQTT_CLIENT_ID_LEN];

static void buildIds() {
  strncpy(s_deviceId, DEVICE_ID, sizeof(s_deviceId) - 1);
  s_deviceId[sizeof(s_deviceId) - 1] = 0;
  snprintf(s_clientId, sizeof(s_clientId), "sfm-%s", s_deviceId);
}

bool AppState_begin() {
  s_timeMutex = xSemaphoreCreateMutex();
  s_sdMutex = xSemaphoreCreateMutex();
  s_metaMutex = xSemaphoreCreateMutex();
  s_ringMutex = xSemaphoreCreateMutex();
  s_sensorQueue = xQueueCreate(SENSOR_QUEUE_LEN, sizeof(SensorRecord));
  s_realtimeMailbox = xQueueCreate(REALTIME_MAILBOX_LEN, sizeof(SensorRecord));
  s_minuteMailbox = xQueueCreate(MINUTE_MAILBOX_LEN, sizeof(SensorRecord));
  s_controlQueue = xQueueCreate(CONTROL_QUEUE_LEN, sizeof(ControlMsg));

  if (!s_timeMutex || !s_sdMutex || !s_metaMutex || !s_ringMutex ||
      !s_sensorQueue || !s_realtimeMailbox || !s_minuteMailbox ||
      !s_controlQueue) {
    return false;
  }

  buildIds();

  if (s_prefs.begin("sfm", false)) {
    s_sequence.store(s_prefs.getUInt("last_seq", 0));
    s_lastAck.store(s_prefs.getUInt("last_ack", 0));
  }

  memset(&s_timeCache, 0, sizeof(s_timeCache));
  s_timeCache.quality = TIME_UNSYNCED;
  return true;
}

uint32_t AppState_nextSequence() {
  return s_sequence.fetch_add(1) + 1;
}

uint32_t AppState_peekSequence() {
  return s_sequence.load();
}

void AppState_persistSequence(uint32_t seq) {
  if (xSemaphoreTake(s_metaMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
    s_prefs.putUInt("last_seq", seq);
    xSemaphoreGive(s_metaMutex);
  }
}

void AppState_setLastAck(uint32_t ack) {
  uint32_t cur = s_lastAck.load();
  while (ack > cur && !s_lastAck.compare_exchange_weak(cur, ack)) {
  }
}

uint32_t AppState_getLastAck() {
  return s_lastAck.load();
}

void AppState_persistAck(uint32_t ack) {
  if (xSemaphoreTake(s_metaMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
    s_prefs.putUInt("last_ack", ack);
    xSemaphoreGive(s_metaMutex);
  }
}

void AppState_readTimeCache(TimeCache* out) {
  if (!out) {
    return;
  }
  if (xSemaphoreTake(s_timeMutex, pdMS_TO_TICKS(5)) == pdTRUE) {
    *out = s_timeCache;
    xSemaphoreGive(s_timeMutex);
  } else {
    *out = s_timeCache;
  }
}

void AppState_writeTimeCache(const TimeCache* in) {
  if (!in) {
    return;
  }
  if (xSemaphoreTake(s_timeMutex, pdMS_TO_TICKS(20)) == pdTRUE) {
    s_timeCache = *in;
    xSemaphoreGive(s_timeMutex);
  }
}

bool AppState_ramRingPush(const SensorRecord* rec) {
  if (!rec) {
    return false;
  }
  if (xSemaphoreTake(s_ringMutex, pdMS_TO_TICKS(20)) != pdTRUE) {
    return false;
  }
  if (s_ringCount == RAM_RING_LEN) {
    s_ringTail = (uint16_t)((s_ringTail + 1) % RAM_RING_LEN);
    s_ringCount--;
  }
  s_ramRing[s_ringHead] = *rec;
  s_ringHead = (uint16_t)((s_ringHead + 1) % RAM_RING_LEN);
  s_ringCount++;
  xSemaphoreGive(s_ringMutex);
  return true;
}

bool AppState_ramRingPop(SensorRecord* rec) {
  if (!rec) {
    return false;
  }
  if (xSemaphoreTake(s_ringMutex, pdMS_TO_TICKS(10)) != pdTRUE) {
    return false;
  }
  if (s_ringCount == 0) {
    xSemaphoreGive(s_ringMutex);
    return false;
  }
  *rec = s_ramRing[s_ringTail];
  s_ringTail = (uint16_t)((s_ringTail + 1) % RAM_RING_LEN);
  s_ringCount--;
  xSemaphoreGive(s_ringMutex);
  return true;
}

uint16_t AppState_ramRingCount() {
  uint16_t n = 0;
  if (xSemaphoreTake(s_ringMutex, pdMS_TO_TICKS(5)) == pdTRUE) {
    n = s_ringCount;
    xSemaphoreGive(s_ringMutex);
  }
  return n;
}

void AppState_noteHeartbeat(uint8_t which) {
  if (which < 7) {
    s_heartbeatMs[which] = millis();
  }
}

uint32_t AppState_heartbeatAgeMs(uint8_t which) {
  if (which >= 7) {
    return UINT32_MAX;
  }
  return (uint32_t)(millis() - s_heartbeatMs[which]);
}

void AppState_countModbusTimeout() { s_modbusTimeouts.fetch_add(1); }
void AppState_countModbusBadFrame() { s_modbusBadFrames.fetch_add(1); }
void AppState_countQueueDrop() { s_queueDrops.fetch_add(1); }
void AppState_countReconnect() { s_reconnects.fetch_add(1); }
void AppState_setSdOk(bool ok) { s_sdOk.store(ok); }
void AppState_setWifiOk(bool ok) { s_wifiOk.store(ok); }
void AppState_setMqttOk(bool ok) { s_mqttOk.store(ok); }
void AppState_setRtcOk(bool ok) { s_rtcOk.store(ok); }
void AppState_setNtpOk(bool ok) { s_ntpOk.store(ok); }
void AppState_setModbusOk(bool ok) { s_modbusOk.store(ok); }
void AppState_setQueueWatermark(uint16_t used) { s_queueWatermark.store(used); }
void AppState_setBacklogEstimate(uint32_t n) { s_backlog.store(n); }

void AppState_captureHealth(HealthSnapshot* out) {
  if (!out) {
    return;
  }
  out->sd_ok = s_sdOk.load();
  out->wifi_ok = s_wifiOk.load();
  out->mqtt_ok = s_mqttOk.load();
  out->rtc_ok = s_rtcOk.load();
  out->ntp_ok = s_ntpOk.load();
  out->modbus_ok = s_modbusOk.load();
  out->last_sequence = s_sequence.load();
  out->last_ack = s_lastAck.load();
  out->modbus_timeout_count = s_modbusTimeouts.load();
  out->modbus_bad_frame_count = s_modbusBadFrames.load();
  out->queue_drop_count = s_queueDrops.load();
  out->reconnect_count = s_reconnects.load();
  out->ram_ring_count = AppState_ramRingCount();
  out->queue_watermark = s_queueWatermark.load();
  out->backlog_estimate = s_backlog.load();
}

void AppState_getDeviceId(char* buf, size_t len) {
  if (buf && len) {
    strncpy(buf, s_deviceId, len - 1);
    buf[len - 1] = 0;
  }
}

void AppState_getClientId(char* buf, size_t len) {
  if (buf && len) {
    strncpy(buf, s_clientId, len - 1);
    buf[len - 1] = 0;
  }
}

void AppState_topic(char* buf, size_t len, const char* suffix) {
  if (!buf || !len) {
    return;
  }
  snprintf(buf, len, "%s/%s/%s", MQTT_TOPIC_PREFIX, s_deviceId, suffix);
}

bool AppState_postControl(const ControlMsg* msg) {
  if (!msg || !s_controlQueue) {
    return false;
  }
  if (msg->type == CTRL_SAMPLE) {
    return xQueueSend(s_controlQueue, msg, 0) == pdTRUE;
  }
  return xQueueSend(s_controlQueue, msg, pdMS_TO_TICKS(100)) == pdTRUE;
}

QueueHandle_t AppState_sensorQueue() { return s_sensorQueue; }
QueueHandle_t AppState_realtimeMailbox() { return s_realtimeMailbox; }
QueueHandle_t AppState_minuteMailbox() { return s_minuteMailbox; }
QueueHandle_t AppState_controlQueue() { return s_controlQueue; }
SemaphoreHandle_t AppState_sdMutex() { return s_sdMutex; }
SemaphoreHandle_t AppState_metaMutex() { return s_metaMutex; }
