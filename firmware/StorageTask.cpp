#include "StorageTask.h"

#include <esp_task_wdt.h>

#include "AppState.h"
#include "Journal.h"
#include "AppConfig.h"

void StorageTask(void* arg) {
  (void)arg;
  esp_task_wdt_add(nullptr);
  JournalMeta meta;
  Journal_loadMeta(&meta);

  const uint32_t nvsSeq = AppState_peekSequence();
  const uint32_t nvsAck = AppState_getLastAck();
  if (meta.last_sequence < nvsSeq) {
    meta.last_sequence = nvsSeq;
  }
  if (meta.last_ack < nvsAck) {
    meta.last_ack = nvsAck;
  }

  uint32_t sinceFlush = 0;

  for (;;) {
    SensorRecord rec;
    if (xQueueReceive(AppState_sensorQueue(), &rec, pdMS_TO_TICKS(500)) !=
        pdTRUE) {
      AppState_noteHeartbeat(HB_STORAGE);
      esp_task_wdt_reset();
      continue;
    }

    if (rec.sequence > meta.last_sequence) {
      meta.last_sequence = rec.sequence;
    }

    if (!Journal_append(&rec)) {
      AppState_setSdOk(false);
      AppState_ramRingPush(&rec);
    } else {
      AppState_setSdOk(true);
    }

    sinceFlush++;
    if (sinceFlush >= SEQ_NVS_FLUSH_EVERY) {
      AppState_persistSequence(meta.last_sequence);
      Journal_touchSequence(meta.last_sequence);
      sinceFlush = 0;
    }

    const uint32_t ack = AppState_getLastAck();
    uint32_t backlog = 0;
    if (meta.last_sequence > ack) {
      backlog = meta.last_sequence - ack;
    }
    AppState_setBacklogEstimate(backlog);

    AppState_noteHeartbeat(HB_STORAGE);
    esp_task_wdt_reset();
  }
}
