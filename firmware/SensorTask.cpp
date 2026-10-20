#include "SensorTask.h"

#include <esp_task_wdt.h>

#include "AppState.h"
#include "ModbusFlow.h"
#include "AppConfig.h"
#include "types.h"

void SensorTask(void* arg) {
  (void)arg;
  esp_task_wdt_add(nullptr);
  TickType_t lastWake = xTaskGetTickCount();

  float flowSum = 0;
  uint16_t flowCount = 0;
  uint16_t lastVolumeRaw = 0;
  uint32_t minuteBucket = 0;
  bool haveMinute = false;

  for (;;) {
    TimeCache tc;
    AppState_readTimeCache(&tc);

    const uint32_t nowMs = millis();
    uint32_t unixTime = tc.unix_time;
    uint16_t millisFrac = 0;
    if (tc.unix_time != 0) {
      const uint32_t elapsed = nowMs - tc.millis_at_update;
      unixTime = tc.unix_time + (elapsed / 1000);
      millisFrac = (uint16_t)(elapsed % 1000);
    }

    uint16_t flowRaw = 0;
    uint16_t volumeRaw = 0;
    RecordStatus status = MODBUS_TIMEOUT;
    ModbusFlow_read(&flowRaw, &volumeRaw, &status);

    if (status == RECORD_OK) {
      AppState_setModbusOk(true);
    } else {
      AppState_setModbusOk(false);
      if (status == MODBUS_TIMEOUT) {
        AppState_countModbusTimeout();
      } else {
        AppState_countModbusBadFrame();
      }
    }

    SensorRecord live = {};
    live.sequence = 0;
    live.unix_time = unixTime;
    live.millis_frac = millisFrac;
    live.flow_raw = flowRaw;
    live.volume_raw = volumeRaw;
    live.status = status;
    live.time_quality = tc.quality;
    xQueueOverwrite(AppState_realtimeMailbox(), &live);

    ControlMsg sample = {};
    sample.type = CTRL_SAMPLE;
    sample.odometer = volumeRaw / VOLUME_RAW_DIVISOR;
    sample.flowrate = flowRaw / FLOW_RAW_DIVISOR;
    sample.sample_ok = (status == RECORD_OK);
    AppState_postControl(&sample);

    if (status == RECORD_OK) {
      flowSum += (flowRaw / FLOW_RAW_DIVISOR);
      flowCount++;
      lastVolumeRaw = volumeRaw;
    }

    const uint32_t bucket =
        (unixTime >= TIME_VALID_UNIX_MIN) ? (unixTime / 60) : 0;
    if (bucket != 0) {
      if (!haveMinute) {
        minuteBucket = bucket;
        haveMinute = true;
      } else if (bucket != minuteBucket) {
        SensorRecord minute = {};
        minute.sequence = AppState_nextSequence();
        minute.unix_time = minuteBucket * 60;
        minute.millis_frac = 0;
        minute.flow_raw =
            flowCount > 0
                ? (uint16_t)((flowSum / flowCount) * FLOW_RAW_DIVISOR + 0.5f)
                : 0;
        minute.volume_raw = lastVolumeRaw;
        minute.status = RECORD_OK;
        minute.time_quality = tc.quality;

        if (xQueueSend(AppState_sensorQueue(), &minute, 0) != pdTRUE) {
          AppState_countQueueDrop();
          AppState_ramRingPush(&minute);
        } else {
          const UBaseType_t waiting =
              uxQueueMessagesWaiting(AppState_sensorQueue());
          AppState_setQueueWatermark((uint16_t)waiting);
        }
        xQueueOverwrite(AppState_minuteMailbox(), &minute);

        flowSum = 0;
        flowCount = 0;
        minuteBucket = bucket;
      }
    }

#if SERIAL_MODBUS_LIVE
    if (status == RECORD_OK) {
      Serial.printf("Flow: %.2f L/min  |  Volume: %.2f  OK\n",
                    flowRaw / FLOW_RAW_DIVISOR,
                    volumeRaw / VOLUME_RAW_DIVISOR);
    } else if (status == MODBUS_TIMEOUT) {
      Serial.println("TIMEOUT");
    } else {
      Serial.println("BAD_FRAME");
    }
#endif

    AppState_noteHeartbeat(HB_SENSOR);
    esp_task_wdt_reset();

    vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(SAMPLE_PERIOD_MS));
  }
}
