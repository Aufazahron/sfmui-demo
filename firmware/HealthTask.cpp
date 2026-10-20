#include "HealthTask.h"

#include <esp_idf_version.h>
#include <esp_task_wdt.h>

#include "AppState.h"
#include "AppConfig.h"

void Health_initWdt() {
#if defined(ESP_IDF_VERSION_MAJOR) && (ESP_IDF_VERSION_MAJOR >= 5)
  esp_task_wdt_config_t cfg = {
      .timeout_ms = WDT_TIMEOUT_MS,
      .idle_core_mask = 0,
      .trigger_panic = true,
  };
  if (esp_task_wdt_reconfigure(&cfg) != ESP_OK) {
    esp_task_wdt_init(&cfg);
  }
#else
  esp_task_wdt_init(WDT_TIMEOUT_MS / 1000, true);
#endif
}

void HealthTask(void* arg) {
  (void)arg;
  esp_task_wdt_add(nullptr);
  uint32_t lastPrint = millis();

  for (;;) {
    AppState_noteHeartbeat(HB_HEALTH);
    esp_task_wdt_reset();

    if (millis() > 15000) {
      const uint32_t sensorAge = AppState_heartbeatAgeMs(HB_SENSOR);
      if (sensorAge > SENSOR_HEARTBEAT_STALE_RESTART_MS) {
        Serial.println("[H] SensorTask stalled, restarting");
        delay(50);
        esp_restart();
      }
    }

    if ((millis() - lastPrint) >= HEALTH_PRINT_PERIOD_MS) {
#if !SERIAL_MODBUS_LIVE
      HealthSnapshot h;
      AppState_captureHealth(&h);
      Serial.printf(
          "[H] seq=%lu ack=%lu sd=%u wifi=%u mqtt=%u rtc=%u ntp=%u "
          "mb=%u drop=%lu to=%lu bad=%lu ring=%u q=%u back=%lu\n",
          (unsigned long)h.last_sequence, (unsigned long)h.last_ack,
          h.sd_ok ? 1 : 0, h.wifi_ok ? 1 : 0, h.mqtt_ok ? 1 : 0,
          h.rtc_ok ? 1 : 0, h.ntp_ok ? 1 : 0, h.modbus_ok ? 1 : 0,
          (unsigned long)h.queue_drop_count,
          (unsigned long)h.modbus_timeout_count,
          (unsigned long)h.modbus_bad_frame_count, h.ram_ring_count,
          h.queue_watermark, (unsigned long)h.backlog_estimate);
#endif
      lastPrint = millis();
    }

    vTaskDelay(pdMS_TO_TICKS(500));
  }
}
