#include "SyncTask.h"

#include "AppState.h"
#include "DeviceConfig.h"
#include "Journal.h"
#include "NetworkTask.h"
#include "ProtoUtil.h"
#include "AppConfig.h"

void SyncTask(void* arg) {
  (void)arg;
  JournalMeta meta;
  Journal_loadMeta(&meta);

  for (;;) {
    AppState_noteHeartbeat(HB_SYNC);

    HealthSnapshot health;
    AppState_captureHealth(&health);

    if (!health.mqtt_ok || !health.sd_ok) {
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    if (uxQueueSpacesAvailable(AppState_sensorQueue()) <
        QUEUE_PRESSURE_MIN_FREE) {
      vTaskDelay(pdMS_TO_TICKS(200));
      continue;
    }

    char lastRec[40];
    DeviceConfig_getLastRecordedAt(lastRec, sizeof(lastRec));

    uint8_t sent = 0;
    for (uint8_t i = 0; i < SYNC_BATCH_SIZE; i++) {
      SensorRecord rec;
      bool eof = false;
      if (!Journal_readNext(&meta, &rec, &eof)) {
        if (eof) {
          break;
        }
        continue;
      }

      char recordedAt[32];
      Proto_formatIsoUtc(recordedAt, sizeof(recordedAt), rec.unix_time);
      if (!Proto_isoGreater(recordedAt, lastRec)) {
        continue;
      }

      if (!NetworkTask_publishRecord(&rec, true)) {
        if (meta.last_sync_offset >= sizeof(SensorRecord)) {
          meta.last_sync_offset -= (uint32_t)sizeof(SensorRecord);
        }
        break;
      }
      sent++;
      AppState_noteHeartbeat(HB_SYNC);
      vTaskDelay(pdMS_TO_TICKS(SYNC_MIN_INTERVAL_MS));
    }

    if (sent > 0 || meta.last_sync_offset > 0) {
      Journal_touchSync(meta.last_sync_day, meta.last_sync_offset);
    }

    uint32_t backlog = 0;
    const uint32_t seq = AppState_peekSequence();
    if (seq > meta.last_sync_offset / sizeof(SensorRecord)) {
      backlog = seq;
    }
    AppState_setBacklogEstimate(backlog);

    vTaskDelay(pdMS_TO_TICKS(200));
  }
}
