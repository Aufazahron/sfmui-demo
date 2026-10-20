#include "DeviceConfig.h"

#include <Preferences.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <stdio.h>

#include "AppConfig.h"

static Preferences s_cfg;
static SemaphoreHandle_t s_mutex = nullptr;

static DeviceConfigSnapshot s_snap = {};
static ValveState s_valve = VALVE_CLOSED;
static ValveCause s_cause = CAUSE_MANUAL;
static uint32_t s_dayKey = 0;
static float s_dailyUsage = 0;
static float s_lastOdo = 0;
static bool s_hasLastOdo = false;
static char s_lastRecordedAt[40] = "";

static bool lock() {
  return xSemaphoreTake(s_mutex, pdMS_TO_TICKS(100)) == pdTRUE;
}

static void unlock() { xSemaphoreGive(s_mutex); }

static void defaults() {
  s_snap.config_version = 0;
  s_snap.automatic = false;
  s_snap.daily_limit = 0;
  s_snap.schedule.active = false;
  for (int i = 0; i < 7; i++) {
    s_snap.schedule.days[i] = true;
  }
  s_snap.schedule.open_hour = 0;
  s_snap.schedule.open_min = 0;
  s_snap.schedule.close_hour = 0;
  s_snap.schedule.close_min = 0;
}

static const char* findKey(const char* json, const char* key) {
  char pattern[48];
  snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  const char* p = strstr(json, pattern);
  if (!p) {
    return nullptr;
  }
  p = strchr(p + strlen(pattern), ':');
  if (!p) {
    return nullptr;
  }
  p++;
  while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') {
    p++;
  }
  return p;
}

static bool extractString(const char* json, const char* key, char* out, size_t outLen) {
  const char* p = findKey(json, key);
  if (!p || *p != '\"') {
    return false;
  }
  p++;
  size_t i = 0;
  while (*p && *p != '\"' && i + 1 < outLen) {
    out[i++] = *p++;
  }
  out[i] = 0;
  return i > 0;
}

static bool extractNumber(const char* json, const char* key, double* out) {
  const char* p = findKey(json, key);
  if (!p) {
    return false;
  }
  char* end = nullptr;
  const double v = strtod(p, &end);
  if (end == p) {
    return false;
  }
  *out = v;
  return true;
}

static bool parseHhMm(const char* s, uint8_t* hour, uint8_t* minute) {
  if (!s || strlen(s) < 4) {
    return false;
  }
  int h = 0;
  int m = 0;
  if (sscanf(s, "%d:%d", &h, &m) != 2) {
    return false;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return false;
  }
  *hour = (uint8_t)h;
  *minute = (uint8_t)m;
  return true;
}

static int dayNameIndex(const char* name) {
  static const char* names[] = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
  for (int i = 0; i < 7; i++) {
    if (strncmp(name, names[i], 3) == 0) {
      return i;
    }
  }
  return -1;
}

static void parseScheduleObject(const char* json, DeviceSchedule* sch) {
  const char* p = findKey(json, "active");
  if (p) {
    sch->active = (strncmp(p, "true", 4) == 0);
  }

  char tbuf[16];
  if (extractString(json, "openTime", tbuf, sizeof(tbuf))) {
    parseHhMm(tbuf, &sch->open_hour, &sch->open_min);
  }
  if (extractString(json, "closeTime", tbuf, sizeof(tbuf))) {
    parseHhMm(tbuf, &sch->close_hour, &sch->close_min);
  }

  const char* days = strstr(json, "\"days\"");
  if (days) {
    for (int i = 0; i < 7; i++) {
      sch->days[i] = false;
    }
    const char* arr = strchr(days, '[');
    const char* end = arr ? strchr(arr, ']') : nullptr;
    if (arr && end) {
      const char* cur = arr;
      while (cur < end) {
        const char* q = strchr(cur, '\"');
        if (!q || q >= end) {
          break;
        }
        q++;
        char name[8];
        size_t n = 0;
        while (*q && *q != '\"' && n + 1 < sizeof(name)) {
          name[n++] = *q++;
        }
        name[n] = 0;
        const int idx = dayNameIndex(name);
        if (idx >= 0) {
          sch->days[idx] = true;
        }
        cur = q + 1;
      }
    }
  }
}

static void persistLocked() {
  s_cfg.putUInt("cfg_ver", s_snap.config_version);
  s_cfg.putBool("auto", s_snap.automatic);
  s_cfg.putFloat("dlimit", s_snap.daily_limit);
  s_cfg.putBool("sch_act", s_snap.schedule.active);
  s_cfg.putUChar("o_h", s_snap.schedule.open_hour);
  s_cfg.putUChar("o_m", s_snap.schedule.open_min);
  s_cfg.putUChar("c_h", s_snap.schedule.close_hour);
  s_cfg.putUChar("c_m", s_snap.schedule.close_min);
  uint8_t dayBits = 0;
  for (int i = 0; i < 7; i++) {
    if (s_snap.schedule.days[i]) {
      dayBits |= (uint8_t)(1u << i);
    }
  }
  s_cfg.putUChar("days", dayBits);
  s_cfg.putUChar("valve", (uint8_t)s_valve);
  s_cfg.putUChar("cause", (uint8_t)s_cause);
  s_cfg.putUInt("daykey", s_dayKey);
  s_cfg.putFloat("dusage", s_dailyUsage);
  s_cfg.putFloat("lodo", s_lastOdo);
  s_cfg.putBool("has_odo", s_hasLastOdo);
  s_cfg.putString("last_rec", s_lastRecordedAt);
}

bool DeviceConfig_begin() {
  s_mutex = xSemaphoreCreateMutex();
  if (!s_mutex) {
    return false;
  }
  defaults();
  if (!s_cfg.begin("sfm_cfg", false)) {
    return false;
  }

  s_snap.config_version = s_cfg.getUInt("cfg_ver", 0);
  s_snap.automatic = s_cfg.getBool("auto", false);
  s_snap.daily_limit = s_cfg.getFloat("dlimit", 0);
  s_snap.schedule.active = s_cfg.getBool("sch_act", false);
  s_snap.schedule.open_hour = s_cfg.getUChar("o_h", 0);
  s_snap.schedule.open_min = s_cfg.getUChar("o_m", 0);
  s_snap.schedule.close_hour = s_cfg.getUChar("c_h", 0);
  s_snap.schedule.close_min = s_cfg.getUChar("c_m", 0);
  const uint8_t dayBits = s_cfg.getUChar("days", 0x7F);
  for (int i = 0; i < 7; i++) {
    s_snap.schedule.days[i] = (dayBits & (1u << i)) != 0;
  }
  s_valve = (ValveState)s_cfg.getUChar("valve", VALVE_CLOSED);
  s_cause = (ValveCause)s_cfg.getUChar("cause", CAUSE_MANUAL);
  s_dayKey = s_cfg.getUInt("daykey", 0);
  s_dailyUsage = s_cfg.getFloat("dusage", 0);
  s_lastOdo = s_cfg.getFloat("lodo", 0);
  s_hasLastOdo = s_cfg.getBool("has_odo", false);
  String last = s_cfg.getString("last_rec", "");
  strncpy(s_lastRecordedAt, last.c_str(), sizeof(s_lastRecordedAt) - 1);
  return true;
}

void DeviceConfig_get(DeviceConfigSnapshot* out) {
  if (!out) {
    return;
  }
  if (lock()) {
    *out = s_snap;
    unlock();
  } else {
    *out = s_snap;
  }
}

bool DeviceConfig_applyJson(const char* json, size_t len) {
  if (!json || len == 0) {
    return false;
  }
  char* buf = (char*)malloc(len + 1);
  if (!buf) {
    return false;
  }
  memcpy(buf, json, len);
  buf[len] = 0;

  DeviceConfigSnapshot next = s_snap;
  double num = 0;
  if (extractNumber(buf, "config_version", &num)) {
    next.config_version = (uint32_t)num;
  }
  char mode[16];
  if (extractString(buf, "mode", mode, sizeof(mode))) {
    next.automatic = (strcmp(mode, "automatic") == 0);
  }
  if (extractNumber(buf, "daily_limit", &num)) {
    next.daily_limit = (float)num;
  }
  parseScheduleObject(buf, &next.schedule);
  free(buf);

  if (!lock()) {
    return false;
  }
  s_snap = next;
  persistLocked();
  unlock();
  return true;
}

ValveState DeviceConfig_getValve() {
  return s_valve;
}

ValveCause DeviceConfig_getValveCause() {
  return s_cause;
}

void DeviceConfig_setValve(ValveState state, ValveCause cause) {
  if (!lock()) {
    return;
  }
  s_valve = state;
  s_cause = cause;
  persistLocked();
  unlock();
}

uint32_t DeviceConfig_dayKey() { return s_dayKey; }

float DeviceConfig_dailyUsage() { return s_dailyUsage; }

void DeviceConfig_setDailyUsage(uint32_t dayKey, float usage) {
  if (!lock()) {
    return;
  }
  s_dayKey = dayKey;
  s_dailyUsage = usage;
  unlock();
}

void DeviceConfig_setLastOdo(float odo) {
  if (!lock()) {
    return;
  }
  s_lastOdo = odo;
  s_hasLastOdo = true;
  unlock();
}

void DeviceConfig_persistUsage() {
  if (!lock()) {
    return;
  }
  persistLocked();
  unlock();
}

float DeviceConfig_lastOdo() { return s_lastOdo; }

bool DeviceConfig_hasLastOdo() { return s_hasLastOdo; }

void DeviceConfig_setLastRecordedAt(const char* iso) {
  if (!iso) {
    return;
  }
  if (!lock()) {
    return;
  }
  strncpy(s_lastRecordedAt, iso, sizeof(s_lastRecordedAt) - 1);
  s_lastRecordedAt[sizeof(s_lastRecordedAt) - 1] = 0;
  persistLocked();
  unlock();
}

void DeviceConfig_getLastRecordedAt(char* buf, size_t len) {
  if (!buf || !len) {
    return;
  }
  if (lock()) {
    strncpy(buf, s_lastRecordedAt, len - 1);
    buf[len - 1] = 0;
    unlock();
  } else {
    buf[0] = 0;
  }
}

const char* ValveCause_str(ValveCause c) {
  switch (c) {
    case CAUSE_COMMAND:
      return "command";
    case CAUSE_SCHEDULE:
      return "schedule";
    case CAUSE_LIMIT:
      return "limit";
    default:
      return "manual";
  }
}

const char* ValveState_str(ValveState s) {
  return s == VALVE_OPEN ? "open" : "closed";
}
