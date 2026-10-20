#include "Journal.h"

#include <SD.h>
#include <SPI.h>
#include <string.h>
#include <time.h>

#include "AppState.h"
#include "AppConfig.h"

static SPIClass s_spi(FSPI);
static bool s_sdReady = false;

static bool lockSd() {
  return xSemaphoreTake(AppState_sdMutex(), pdMS_TO_TICKS(200)) == pdTRUE;
}

static void unlockSd() { xSemaphoreGive(AppState_sdMutex()); }

static bool ensureDirUnlocked() {
  if (SD.exists(JOURNAL_DIR)) {
    return true;
  }
  return SD.mkdir(JOURNAL_DIR);
}

static void dayPath(uint32_t day, char* buf, size_t len) {
  if (day == 0) {
    snprintf(buf, len, "%s/unsynced.bin", JOURNAL_DIR);
  } else {
    snprintf(buf, len, "%s/%08lu.bin", JOURNAL_DIR, (unsigned long)day);
  }
}

uint32_t Journal_dayFromUnix(uint32_t unixTime) {
  if (unixTime < TIME_VALID_UNIX_MIN) {
    return 0;
  }
  time_t t = (time_t)(unixTime + WIB_OFFSET_SEC);
  struct tm tmLocal;
  gmtime_r(&t, &tmLocal);
  return (uint32_t)((tmLocal.tm_year + 1900) * 10000 +
                    (tmLocal.tm_mon + 1) * 100 + tmLocal.tm_mday);
}

static uint32_t nextDay(uint32_t yyyymmdd) {
  if (yyyymmdd == 0) {
    return 0;
  }
  struct tm tm = {};
  tm.tm_year = (int)(yyyymmdd / 10000) - 1900;
  tm.tm_mon = (int)((yyyymmdd / 100) % 100) - 1;
  tm.tm_mday = (int)(yyyymmdd % 100) + 1;
  tm.tm_hour = 12;
  tm.tm_isdst = -1;
  time_t t = mktime(&tm);
  if (t == (time_t)-1) {
    return yyyymmdd;
  }
  struct tm out;
  localtime_r(&t, &out);
  return (uint32_t)((out.tm_year + 1900) * 10000 + (out.tm_mon + 1) * 100 +
                    out.tm_mday);
}

bool Journal_begin() {
  if (!lockSd()) {
    AppState_setSdOk(false);
    return false;
  }

  s_spi.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  s_sdReady = SD.begin(SD_CS, s_spi);
  if (s_sdReady) {
    s_sdReady = ensureDirUnlocked();
  }
  AppState_setSdOk(s_sdReady);
  unlockSd();
  return s_sdReady;
}

void Journal_loadMeta(JournalMeta* meta) {
  if (!meta) {
    return;
  }
  memset(meta, 0, sizeof(*meta));
  meta->magic = JOURNAL_META_MAGIC;

  if (!s_sdReady || !lockSd()) {
    return;
  }

  File f = SD.open(JOURNAL_META_PATH, FILE_READ);
  if (f) {
    JournalMeta tmp = {};
    const size_t n = f.read((uint8_t*)&tmp, sizeof(tmp));
    f.close();
    if (n == sizeof(tmp) && tmp.magic == JOURNAL_META_MAGIC) {
      *meta = tmp;
    }
  }
  unlockSd();
}

void Journal_saveMeta(const JournalMeta* meta) {
  if (!meta || !s_sdReady) {
    return;
  }
  if (!lockSd()) {
    return;
  }
  File f = SD.open(JOURNAL_META_PATH, FILE_WRITE);
  if (f) {
    f.seek(0);
    f.write((const uint8_t*)meta, sizeof(*meta));
    f.flush();
    f.close();
  }
  unlockSd();
}

static void patchMeta(void (*fn)(JournalMeta*, void*), void* ctx) {
  if (xSemaphoreTake(AppState_metaMutex(), pdMS_TO_TICKS(200)) != pdTRUE) {
    return;
  }
  JournalMeta meta;
  Journal_loadMeta(&meta);
  fn(&meta, ctx);
  Journal_saveMeta(&meta);
  xSemaphoreGive(AppState_metaMutex());
}

static void patchSeq(JournalMeta* m, void* ctx) {
  const uint32_t seq = *(uint32_t*)ctx;
  if (seq > m->last_sequence) {
    m->last_sequence = seq;
  }
}

static void patchAck(JournalMeta* m, void* ctx) {
  const uint32_t ack = *(uint32_t*)ctx;
  if (ack > m->last_ack) {
    m->last_ack = ack;
  }
}

struct SyncPatch {
  uint32_t day;
  uint32_t offset;
};

static void patchSync(JournalMeta* m, void* ctx) {
  const SyncPatch* p = (const SyncPatch*)ctx;
  m->last_sync_day = p->day;
  m->last_sync_offset = p->offset;
}

void Journal_touchSequence(uint32_t seq) { patchMeta(patchSeq, &seq); }

void Journal_touchAck(uint32_t ack) { patchMeta(patchAck, &ack); }

void Journal_touchSync(uint32_t day, uint32_t offset) {
  SyncPatch p = {day, offset};
  patchMeta(patchSync, &p);
}

bool Journal_append(const SensorRecord* rec) {
  if (!rec) {
    return false;
  }
  if (!s_sdReady) {
    if (!Journal_begin()) {
      return false;
    }
  }
  if (!lockSd()) {
    return false;
  }

  const uint32_t day = Journal_dayFromUnix(rec->unix_time);
  char path[40];
  dayPath(day, path, sizeof(path));
  File f = SD.open(path, FILE_APPEND);
  if (!f) {
    AppState_setSdOk(false);
    s_sdReady = false;
    unlockSd();
    return false;
  }

  const size_t n = f.write((const uint8_t*)rec, sizeof(*rec));
  f.flush();
  f.close();
  const bool ok = (n == sizeof(*rec));
  if (!ok) {
    s_sdReady = false;
    AppState_setSdOk(false);
  } else {
    AppState_setSdOk(true);
  }
  unlockSd();
  return ok;
}

bool Journal_readNext(JournalMeta* meta, SensorRecord* rec, bool* eof) {
  if (!meta || !rec || !eof) {
    return false;
  }
  *eof = false;

  if (!s_sdReady && !Journal_begin()) {
    *eof = true;
    return false;
  }

  TimeCache tc;
  AppState_readTimeCache(&tc);
  const uint32_t today = Journal_dayFromUnix(tc.unix_time);

  if (!lockSd()) {
    return false;
  }

  char path[40];
  dayPath(meta->last_sync_day, path, sizeof(path));
  File f = SD.open(path, FILE_READ);
  if (!f) {
    unlockSd();
    if (meta->last_sync_day == 0 && today != 0) {
      meta->last_sync_day = today;
      meta->last_sync_offset = 0;
      *eof = false;
      return false;
    }
    if (today != 0 && meta->last_sync_day < today) {
      meta->last_sync_day = nextDay(meta->last_sync_day);
      if (meta->last_sync_day > today || meta->last_sync_day == 0) {
        meta->last_sync_day = today;
      }
      meta->last_sync_offset = 0;
      *eof = false;
      return false;
    }
    *eof = true;
    return false;
  }

  if (meta->last_sync_offset >= (uint32_t)f.size()) {
    f.close();
    unlockSd();
    if (meta->last_sync_day == 0 && today != 0) {
      meta->last_sync_day = today;
      meta->last_sync_offset = 0;
      *eof = false;
      return false;
    }
    if (today != 0 && meta->last_sync_day < today) {
      meta->last_sync_day = nextDay(meta->last_sync_day);
      if (meta->last_sync_day > today) {
        meta->last_sync_day = today;
      }
      meta->last_sync_offset = 0;
      *eof = false;
      return false;
    }
    *eof = true;
    return false;
  }

  if (!f.seek(meta->last_sync_offset)) {
    f.close();
    unlockSd();
    return false;
  }

  const size_t n = f.read((uint8_t*)rec, sizeof(*rec));
  f.close();
  unlockSd();

  if (n != sizeof(*rec)) {
    *eof = true;
    return false;
  }

  meta->last_sync_offset += (uint32_t)sizeof(*rec);
  return true;
}
