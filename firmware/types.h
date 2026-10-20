#pragma once

#include <stdint.h>

enum RecordStatus : uint8_t {
  RECORD_OK = 0,
  MODBUS_TIMEOUT = 1,
  MODBUS_BAD_FRAME = 2
};

enum TimeQuality : uint8_t {
  TIME_UNSYNCED = 0,
  TIME_RTC = 1,
  TIME_NTP = 2,
  TIME_RTC_STALE = 3
};

enum ValveState : uint8_t {
  VALVE_CLOSED = 0,
  VALVE_OPEN = 1
};

enum ValveCause : uint8_t {
  CAUSE_COMMAND = 0,
  CAUSE_SCHEDULE = 1,
  CAUSE_LIMIT = 2,
  CAUSE_MANUAL = 3
};

enum ControlMsgType : uint8_t {
  CTRL_VALVE = 1,
  CTRL_CONFIG_APPLIED = 2,
  CTRL_DEV_HYBRID_AP = 3,
  CTRL_SYNC_STATE = 4,
  CTRL_MQTT_RECONNECTED = 5,
  CTRL_SAMPLE = 6
};

struct SensorRecord {
  uint32_t sequence;
  uint32_t unix_time;
  uint16_t millis_frac;
  uint16_t flow_raw;
  uint16_t volume_raw;
  RecordStatus status;
  TimeQuality time_quality;
} __attribute__((packed));

struct TimeCache {
  uint32_t unix_time;
  uint32_t millis_at_update;
  TimeQuality quality;
  bool rtc_ok;
  bool ntp_ok;
};

struct JournalMeta {
  uint32_t magic;
  uint32_t last_sequence;
  uint32_t last_ack;
  uint32_t last_sync_offset;
  uint32_t last_sync_day;
};

struct HealthSnapshot {
  bool sd_ok;
  bool wifi_ok;
  bool mqtt_ok;
  bool rtc_ok;
  bool ntp_ok;
  bool modbus_ok;
  uint32_t last_sequence;
  uint32_t last_ack;
  uint32_t modbus_timeout_count;
  uint32_t modbus_bad_frame_count;
  uint32_t queue_drop_count;
  uint32_t reconnect_count;
  uint32_t ram_ring_count;
  uint16_t queue_watermark;
  uint32_t backlog_estimate;
};

struct ControlMsg {
  ControlMsgType type;
  ValveState valve;
  char command_id[40];
  float odometer;
  float flowrate;
  bool sample_ok;
  char last_recorded_at[40];
};

#define JOURNAL_META_MAGIC 0x53464D31u
