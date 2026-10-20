#include "TimeService.h"

#include <RTClib.h>
#include <WiFi.h>
#include <time.h>

#include "AppState.h"
#include "AppConfig.h"

static RTC_DS3231 s_rtc;
static bool s_rtcPresent = false;
static bool s_ntpConfigured = false;
static uint32_t s_lastNtpAdjustMs = 0;
static bool s_rtcLostPower = false;

static uint32_t nowUnixUtc() {
  time_t t = time(nullptr);
  if (t > (time_t)TIME_VALID_UNIX_MIN) {
    return (uint32_t)t;
  }
  return 0;
}

void TimeService_begin() {
  s_rtcPresent = s_rtc.begin();
  if (s_rtcPresent) {
    s_rtcLostPower = s_rtc.lostPower();
    TimeCache cache = {};
    DateTime now = s_rtc.now();
    cache.unix_time = now.unixtime();
    cache.millis_at_update = millis();
    cache.rtc_ok = true;
    cache.ntp_ok = false;
    cache.quality = s_rtcLostPower ? TIME_RTC_STALE : TIME_RTC;
    AppState_writeTimeCache(&cache);
    AppState_setRtcOk(true);
  } else {
    AppState_setRtcOk(false);
  }
}

void TimeServiceTask(void* arg) {
  (void)arg;
  TickType_t lastWake = xTaskGetTickCount();

  for (;;) {
    AppState_noteHeartbeat(HB_TIME);

    if (!s_ntpConfigured && WiFi.status() == WL_CONNECTED) {
      configTime(NTP_GMT_OFFSET_SEC, NTP_DAYLIGHT_OFFSET, NTP_SERVER_1,
                 NTP_SERVER_2);
      s_ntpConfigured = true;
    }

    const uint32_t ntpUnix = nowUnixUtc();
    const bool ntpOk = ntpUnix >= TIME_VALID_UNIX_MIN;
    AppState_setNtpOk(ntpOk);

    bool rtcOk = s_rtcPresent;
    uint32_t rtcUnix = 0;
    if (s_rtcPresent) {
      DateTime now = s_rtc.now();
      rtcUnix = now.unixtime();
      rtcOk = (rtcUnix > 1000000000UL);
      if (!rtcOk) {
        s_rtcPresent = s_rtc.begin();
        rtcOk = s_rtcPresent;
      }
    } else {
      s_rtcPresent = s_rtc.begin();
      rtcOk = s_rtcPresent;
    }
    AppState_setRtcOk(rtcOk);

    if (ntpOk && rtcOk &&
        (s_lastNtpAdjustMs == 0 ||
         (millis() - s_lastNtpAdjustMs) >= RTC_NTP_SYNC_MS)) {
      const uint32_t diff =
          (ntpUnix > rtcUnix) ? (ntpUnix - rtcUnix) : (rtcUnix - ntpUnix);
      if (diff > 2) {
        s_rtc.adjust(DateTime(ntpUnix));
        rtcUnix = ntpUnix;
      }
      s_rtcLostPower = false;
      s_lastNtpAdjustMs = millis();
    }

    TimeCache cache = {};
    cache.millis_at_update = millis();
    cache.rtc_ok = rtcOk;
    cache.ntp_ok = ntpOk;

    if (ntpOk) {
      cache.unix_time = ntpUnix;
      cache.quality = TIME_NTP;
    } else if (rtcOk) {
      cache.unix_time = rtcUnix;
      cache.quality = s_rtcLostPower ? TIME_RTC_STALE : TIME_RTC;
    } else {
      cache.unix_time = 0;
      cache.quality = TIME_UNSYNCED;
    }

    AppState_writeTimeCache(&cache);
    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(TIME_TASK_PERIOD_MS));
  }
}
