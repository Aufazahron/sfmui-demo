#pragma once

#include <Arduino.h>
#include "types.h"

bool AppState_begin();

uint32_t AppState_nextSequence();
uint32_t AppState_peekSequence();
void AppState_persistSequence(uint32_t seq);
void AppState_setLastAck(uint32_t ack);
uint32_t AppState_getLastAck();
void AppState_persistAck(uint32_t ack);

void AppState_readTimeCache(TimeCache* out);
void AppState_writeTimeCache(const TimeCache* in);

bool AppState_ramRingPush(const SensorRecord* rec);
bool AppState_ramRingPop(SensorRecord* rec);
uint16_t AppState_ramRingCount();

void AppState_noteHeartbeat(uint8_t which);
uint32_t AppState_heartbeatAgeMs(uint8_t which);
void AppState_countModbusTimeout();
void AppState_countModbusBadFrame();
void AppState_countQueueDrop();
void AppState_countReconnect();
void AppState_setSdOk(bool ok);
void AppState_setWifiOk(bool ok);
void AppState_setMqttOk(bool ok);
void AppState_setRtcOk(bool ok);
void AppState_setNtpOk(bool ok);
void AppState_setModbusOk(bool ok);
void AppState_setQueueWatermark(uint16_t used);
void AppState_setBacklogEstimate(uint32_t n);
void AppState_captureHealth(HealthSnapshot* out);

void AppState_getDeviceId(char* buf, size_t len);
void AppState_getClientId(char* buf, size_t len);
void AppState_topic(char* buf, size_t len, const char* suffix);

bool AppState_postControl(const ControlMsg* msg);

QueueHandle_t AppState_sensorQueue();
QueueHandle_t AppState_realtimeMailbox();
QueueHandle_t AppState_minuteMailbox();
QueueHandle_t AppState_controlQueue();
SemaphoreHandle_t AppState_sdMutex();
SemaphoreHandle_t AppState_metaMutex();

enum HeartbeatId : uint8_t {
  HB_SENSOR = 0,
  HB_STORAGE = 1,
  HB_NETWORK = 2,
  HB_TIME = 3,
  HB_SYNC = 4,
  HB_HEALTH = 5,
  HB_CONTROL = 6
};
