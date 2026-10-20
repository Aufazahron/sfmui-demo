#pragma once

#include "types.h"
#include <stddef.h>

struct DeviceSchedule {
  bool active;
  bool days[7];  // Mon=0 .. Sun=6
  uint8_t open_hour;
  uint8_t open_min;
  uint8_t close_hour;
  uint8_t close_min;
};

struct DeviceConfigSnapshot {
  uint32_t config_version;
  bool automatic;  // false = manual
  float daily_limit;
  DeviceSchedule schedule;
};

bool DeviceConfig_begin();

void DeviceConfig_get(DeviceConfigSnapshot* out);
bool DeviceConfig_applyJson(const char* json, size_t len);

ValveState DeviceConfig_getValve();
ValveCause DeviceConfig_getValveCause();
void DeviceConfig_setValve(ValveState state, ValveCause cause);

uint32_t DeviceConfig_dayKey();
float DeviceConfig_dailyUsage();
void DeviceConfig_setDailyUsage(uint32_t dayKey, float usage);
void DeviceConfig_setLastOdo(float odo);
void DeviceConfig_persistUsage();
float DeviceConfig_lastOdo();
bool DeviceConfig_hasLastOdo();

void DeviceConfig_setLastRecordedAt(const char* iso);
void DeviceConfig_getLastRecordedAt(char* buf, size_t len);

const char* ValveCause_str(ValveCause c);
const char* ValveState_str(ValveState s);
