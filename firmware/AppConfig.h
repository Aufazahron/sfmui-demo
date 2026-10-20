#pragma once

#include <Arduino.h>
#include "secrets.h"

// =====================================================
// Waveshare ESP32-S3-Relay-6CH pin map
// =====================================================

#define RTC_SDA 8
#define RTC_SCL 9

#define SD_MOSI 11
#define SD_MISO 13
#define SD_SCK  15
#define SD_CS   14

#define RS485_TX   17
#define RS485_RX   18
#define RS485_BAUD 9600
#define BOOT_DELAY_MS 2000
#define RS485_SETTLE_MS 500

#define RELAY_CH1 1
#define RELAY_CH2 2
#define RELAY_CH3 41
#define RELAY_CH4 42
#define RELAY_CH5 45
#define RELAY_CH6 46

#define RELAY_ON  HIGH
#define RELAY_OFF LOW

// Valve on CH1. Set 1 if HIGH opens the valve, 0 if active-low.
#define VALVE_OPEN_LEVEL 1
#define VALVE_RELAY_PIN  RELAY_CH1

// =====================================================
// Modbus RTU (flow meter)
// =====================================================

#define MODBUS_SLAVE_ID          0x01
#define MODBUS_TIMEOUT_MS        1500
#define MODBUS_RETRY_MAX         1
#define MODBUS_RESPONSE_LEN      9
#define MODBUS_PURGE_QUIET_MS    30
#define MODBUS_PURGE_MAX_MS      200
#define MODBUS_RX_GRACE_MS       300
#define MODBUS_INTERBYTE_MS      20
#define MODBUS_WARMUP_TRIES      5
#define MODBUS_WARMUP_GAP_MS     50
#define MODBUS_STARTUP_RETRY_MS  15000

#define FLOW_RAW_DIVISOR    100.0f
#define VOLUME_RAW_DIVISOR  1.0f

#define SERIAL_MODBUS_LIVE  0

// =====================================================
// Sampling / queues
// =====================================================

#define SAMPLE_PERIOD_MS     1000
#define SENSOR_QUEUE_LEN     32
#define REALTIME_MAILBOX_LEN 1
#define MINUTE_MAILBOX_LEN   1
#define CONTROL_QUEUE_LEN    8
#define RAM_RING_LEN         60

// =====================================================
// Task priorities (higher number = higher priority)
// =====================================================

#define TASK_PRIO_SENSOR  5
#define TASK_PRIO_STORAGE 4
#define TASK_PRIO_CONTROL 4
#define TASK_PRIO_NETWORK 3
#define TASK_PRIO_TIME    2
#define TASK_PRIO_HEALTH  2
#define TASK_PRIO_SYNC    1

#define TASK_CORE_SENSOR 1
#define TASK_CORE_OTHER  0

#define STACK_SENSOR  4096
#define STACK_STORAGE 6144
#define STACK_NETWORK 10240
#define STACK_CONTROL 6144
#define STACK_TIME    4096
#define STACK_SYNC    8192
#define STACK_HEALTH  4096

// =====================================================
// Time / NTP (UTC in TimeCache; WIB = UTC+7 for schedule/day)
// =====================================================

#define NTP_GMT_OFFSET_SEC  0
#define NTP_DAYLIGHT_OFFSET 0
#define WIB_OFFSET_SEC      (7 * 3600)
#define NTP_SERVER_1        "pool.ntp.org"
#define NTP_SERVER_2        "time.nist.gov"
#define TIME_TASK_PERIOD_MS 1000
#define RTC_NTP_SYNC_MS     3600000UL
#define TIME_VALID_UNIX_MIN 1700000000UL

// =====================================================
// MQTT (PROTOCOL.md)
// =====================================================

#define MQTT_KEEPALIVE_SEC      30
#define MQTT_DEVICE_ID_LEN      32
#define MQTT_CLIENT_ID_LEN      40
#define MQTT_TOPIC_LEN          80
#define MQTT_PAYLOAD_LEN        768
#define MQTT_HEALTH_PERIOD_MS   30000
#define MQTT_BACKOFF_MIN_MS     1000
#define MQTT_BACKOFF_MAX_MS     60000
#define WIFI_CONNECT_SLICE_MS   200
#define WIFI_CONNECT_WAIT_MS    8000

#define MQTT_TOPIC_PREFIX "pertamina/sfm"

#ifndef DEVICE_ID
#error "DEVICE_ID must be defined in secrets.h (e.g. sfm-001)"
#endif

// =====================================================
// Sync / journal
// =====================================================

#define SYNC_BATCH_SIZE       5
#define SYNC_MIN_INTERVAL_MS  200
#define JOURNAL_DIR           "/journal"
#define JOURNAL_META_PATH     "/journal/meta.bin"
#define SEQ_NVS_FLUSH_EVERY   10
#define QUEUE_PRESSURE_MIN_FREE 8
#define BACKLOG_READINGS_MAX  5

// =====================================================
// Health / watchdog
// =====================================================

#define WDT_TIMEOUT_MS           15000
#define HEARTBEAT_STALE_MS       5000
#define HEALTH_PRINT_PERIOD_MS   5000
#define SENSOR_HEARTBEAT_STALE_RESTART_MS 8000

#define SERIAL_BAUD 115200

#define HYBRID_AP_PASS "sfm-setup1"
