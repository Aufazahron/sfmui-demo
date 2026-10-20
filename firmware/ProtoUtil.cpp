#include "ProtoUtil.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

#include "AppConfig.h"

void Proto_formatIsoUtc(char* buf, size_t len, uint32_t unixUtc) {
  if (!buf || !len) {
    return;
  }
  if (unixUtc < TIME_VALID_UNIX_MIN) {
    snprintf(buf, len, "1970-01-01T00:00:00Z");
    return;
  }
  time_t t = (time_t)unixUtc;
  struct tm tm;
  gmtime_r(&t, &tm);
  snprintf(buf, len, "%04d-%02d-%02dT%02d:%02d:%02dZ", tm.tm_year + 1900,
           tm.tm_mon + 1, tm.tm_mday, tm.tm_hour, tm.tm_min, tm.tm_sec);
}

uint32_t Proto_wibDayKey(uint32_t unixUtc) {
  if (unixUtc < TIME_VALID_UNIX_MIN) {
    return 0;
  }
  time_t t = (time_t)(unixUtc + WIB_OFFSET_SEC);
  struct tm tm;
  gmtime_r(&t, &tm);
  return (uint32_t)((tm.tm_year + 1900) * 10000 + (tm.tm_mon + 1) * 100 +
                    tm.tm_mday);
}

void Proto_wibHms(uint32_t unixUtc, int* hour, int* minute, int* wdayMon0) {
  time_t t = (time_t)(unixUtc + WIB_OFFSET_SEC);
  struct tm tm;
  gmtime_r(&t, &tm);
  if (hour) {
    *hour = tm.tm_hour;
  }
  if (minute) {
    *minute = tm.tm_min;
  }
  if (wdayMon0) {
    // tm_wday: 0=Sun .. 6=Sat → Mon=0 .. Sun=6
    *wdayMon0 = tm.tm_wday == 0 ? 6 : (tm.tm_wday - 1);
  }
}

bool Proto_isoGreater(const char* a, const char* b) {
  if (!a || !a[0]) {
    return false;
  }
  if (!b || !b[0]) {
    return true;
  }
  return strcmp(a, b) > 0;
}
