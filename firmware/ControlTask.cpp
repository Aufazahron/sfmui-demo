#include "ControlTask.h"

#include <WiFi.h>
#include <atomic>
#include <string.h>

#include "AppConfig.h"
#include "AppState.h"
#include "DeviceConfig.h"
#include "ProtoUtil.h"
#include "Valve.h"
#include "types.h"

static std::atomic<bool> s_publishValve{false};
static uint32_t s_lastUsagePersistMs = 0;

void Control_requestPublishValve() { s_publishValve.store(true); }

bool Control_takePublishValveRequest() {
  return s_publishValve.exchange(false);
}

static void setValve(ValveState state, ValveCause cause) {
  if (DeviceConfig_getValve() == state && DeviceConfig_getValveCause() == cause) {
    Valve_apply(state);
    return;
  }
  Valve_apply(state);
  DeviceConfig_setValve(state, cause);
  Control_requestPublishValve();
  Serial.printf("[CTRL] valve=%s cause=%s\n", ValveState_str(state),
                ValveCause_str(cause));
}

static bool scheduleWantsOpen(const DeviceConfigSnapshot* cfg, uint32_t unixUtc) {
  if (!cfg->automatic || !cfg->schedule.active) {
    return false;
  }
  int hour = 0;
  int minute = 0;
  int wday = 0;
  Proto_wibHms(unixUtc, &hour, &minute, &wday);
  if (wday < 0 || wday > 6 || !cfg->schedule.days[wday]) {
    return false;
  }
  const int nowM = hour * 60 + minute;
  const int openM =
      cfg->schedule.open_hour * 60 + cfg->schedule.open_min;
  const int closeM =
      cfg->schedule.close_hour * 60 + cfg->schedule.close_min;
  if (openM == closeM) {
    return false;
  }
  if (openM < closeM) {
    return nowM >= openM && nowM < closeM;
  }
  // overnight window
  return nowM >= openM || nowM < closeM;
}

static void enforcePolicy(float odometer, bool sampleOk) {
  DeviceConfigSnapshot cfg;
  DeviceConfig_get(&cfg);

  TimeCache tc;
  AppState_readTimeCache(&tc);
  uint32_t unixUtc = tc.unix_time;
  if (unixUtc != 0) {
    const uint32_t elapsed = millis() - tc.millis_at_update;
    unixUtc += elapsed / 1000;
  }

  if (sampleOk && unixUtc >= TIME_VALID_UNIX_MIN) {
    const uint32_t dayKey = Proto_wibDayKey(unixUtc);
    float usage = DeviceConfig_dailyUsage();
    uint32_t storedDay = DeviceConfig_dayKey();
    if (dayKey != 0 && dayKey != storedDay) {
      usage = 0;
      storedDay = dayKey;
      DeviceConfig_setDailyUsage(storedDay, usage);
      DeviceConfig_persistUsage();
      Serial.printf("[CTRL] day rollover %lu usage=0\n",
                    (unsigned long)dayKey);
    }

    if (DeviceConfig_hasLastOdo()) {
      const float prev = DeviceConfig_lastOdo();
      float delta = odometer - prev;
      if (delta < 0) {
        delta = 0;
      }
      if (delta > 0) {
        usage += delta;
        DeviceConfig_setDailyUsage(storedDay ? storedDay : dayKey, usage);
      }
    }
    DeviceConfig_setLastOdo(odometer);

    if ((millis() - s_lastUsagePersistMs) > 30000) {
      DeviceConfig_persistUsage();
      s_lastUsagePersistMs = millis();
    }

    const bool overLimit =
        cfg.daily_limit > 0 && usage >= cfg.daily_limit;
    if (overLimit) {
      setValve(VALVE_CLOSED, CAUSE_LIMIT);
      return;
    }
  }

  if (!cfg.automatic) {
    return;
  }

  if (unixUtc < TIME_VALID_UNIX_MIN) {
    return;
  }

  const bool wantOpen = scheduleWantsOpen(&cfg, unixUtc);
  const bool overLimit =
      cfg.daily_limit > 0 && DeviceConfig_dailyUsage() >= cfg.daily_limit;
  if (overLimit) {
    setValve(VALVE_CLOSED, CAUSE_LIMIT);
    return;
  }
  if (!cfg.schedule.active) {
    return;
  }
  if (wantOpen) {
    setValve(VALVE_OPEN, CAUSE_SCHEDULE);
  } else {
    setValve(VALVE_CLOSED, CAUSE_SCHEDULE);
  }
}

static void handleValveCommand(const ControlMsg* msg) {
  setValve(msg->valve, CAUSE_COMMAND);
}

static void handleHybridAp() {
  char id[MQTT_DEVICE_ID_LEN];
  AppState_getDeviceId(id, sizeof(id));
  char ssid[40];
  snprintf(ssid, sizeof(ssid), "SFM-%s", id);
  WiFi.mode(WIFI_AP_STA);
  const bool ok = WiFi.softAP(ssid, HYBRID_AP_PASS);
  Serial.printf("[CTRL] hybrid AP %s ssid=%s\n", ok ? "ON" : "FAIL", ssid);
}

void ControlTask(void* arg) {
  (void)arg;
  Valve_apply(DeviceConfig_getValve());
  Control_requestPublishValve();

  for (;;) {
    AppState_noteHeartbeat(HB_CONTROL);
    ControlMsg msg;
    if (xQueueReceive(AppState_controlQueue(), &msg, pdMS_TO_TICKS(200)) ==
        pdTRUE) {
      switch (msg.type) {
        case CTRL_VALVE:
          handleValveCommand(&msg);
          break;
        case CTRL_CONFIG_APPLIED:
          Serial.println("[CTRL] config applied");
          enforcePolicy(DeviceConfig_hasLastOdo() ? DeviceConfig_lastOdo() : 0,
                        DeviceConfig_hasLastOdo());
          break;
        case CTRL_DEV_HYBRID_AP:
          handleHybridAp();
          break;
        case CTRL_SYNC_STATE:
          if (msg.last_recorded_at[0]) {
            DeviceConfig_setLastRecordedAt(msg.last_recorded_at);
          }
          break;
        case CTRL_MQTT_RECONNECTED:
          Control_requestPublishValve();
          break;
        case CTRL_SAMPLE:
          enforcePolicy(msg.odometer, msg.sample_ok);
          break;
        default:
          break;
      }
    } else {
      // periodic schedule tick even without samples
      enforcePolicy(DeviceConfig_hasLastOdo() ? DeviceConfig_lastOdo() : 0,
                    false);
    }
  }
}
