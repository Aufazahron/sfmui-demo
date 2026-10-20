# Smart Flow Meter (ESP32-S3, PROTOCOL)

Firmware FreeRTOS untuk Waveshare ESP32-S3-Relay-6CH, selaras dengan [`PROTOCOL.md`](../PROTOCOL.md) dashboard SFMUI.

## Board & library

Arduino IDE 2.x:

1. Board: **ESP32S3 Dev Module** (esp32 by Espressif)
2. USB CDC On Boot: **Enabled**
3. Library: **RTClib**, **PubSubClient**

Buka folder `firmware/` → `SmartFlowMeter.ino`.

## Konfigurasi

Salin `secrets.example.h` → `secrets.h`:

| Macro | Contoh |
|---|---|
| `DEVICE_ID` | `sfm-001` (harus sama dengan node di dashboard) |
| `WIFI_SSID` / `WIFI_PASSWORD` | WiFi lapangan |
| `MQTT_HOST` | `emqx.dtek.co.id` |
| `MQTT_USER` / `MQTT_PASS` | kredensial EMQX |

Pin, valve, dan prioritas task: `AppConfig.h`.

- Valve: **RELAY_CH1** (`VALVE_RELAY_PIN`)
- Polaritas: `VALVE_OPEN_LEVEL` (1 = HIGH = open)

## MQTT (PROTOCOL)

Prefix: `pertamina/sfm/{DEVICE_ID}/`

| Topic | Arah |
|---|---|
| `telemetry/live` | device → broker (~1 Hz) |
| `telemetry/minute` | device → broker (agregat 1 menit) |
| `telemetry/backlog` | device → broker (setelah sync) |
| `status/valve` | device → broker (retain; juga saat reconnect) |
| `status/heartbeat` | device → broker (30 s) |
| `status/lwt` | LWT offline / online retain |
| `command/valve` | server → device |
| `command/config` | server → device (retain) |
| `command/config/ack` | device → broker |
| `command/dev` | server → device (hybrid AP) |
| `sync/state` | server → device |

## Perilaku penting

- **Schedule + daily limit** dijalankan lokal (termasuk offline), mode `automatic`.
- `daily_usage` = delta odometer; reset tiap tanggal **WIB**; limit menang atas schedule.
- Saat MQTT connect: publish `online` → **`status/valve` aktual** → config ack. Menutup miskom UI setelah offline.
- Valve state + cause + usage disimpan NVS; restore relay saat boot.

## Task

| Task | Peran |
|---|---|
| SensorTask | Modbus 1 Hz + agregat menit |
| StorageTask | Journal SD |
| ControlTask | Valve / schedule / limit |
| NetworkTask | WiFi MQTT PROTOCOL |
| SyncTask | Backlog by `last_recorded_at` |
| TimeService | RTC + NTP (UTC cache) |
| HealthTask | Watchdog + Serial |

## Uji checklist

1. Tambah node `DEVICE_ID` di dashboard → live flow + chart minute.
2. Open/Close manual → relay + badge (setelah `status/valve`).
3. Set limit kecil (mis. 5 L) → tutup `cause=limit`.
4. Ganti hari / tunggu 00:00 WIB → usage 0, limit hidup lagi.
5. Putus WiFi → schedule tutup → reconnect → dashboard Closed tanpa klik.
6. Topology Developer mode → hybrid AP `SFM-{DEVICE_ID}` / pass `sfm-setup1`.
