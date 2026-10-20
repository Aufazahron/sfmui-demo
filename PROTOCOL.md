# SFM — MQTT Topics, Payload, Database

Broker: `emqx.dtek.co.id:1883` (WSS: `wss://mqtt.dtek.co.id`)  
Auth MQTT: `pertamina-sfm` (password di `.env`)  
Prefix topic: `pertamina/sfm/{deviceId}/...`  
Contoh device: `sfm-001` → `pertamina/sfm/sfm-001/telemetry/live`

Backend subscribe: `pertamina/sfm/#`  
Device subscribe: `command/valve`, `command/config`, `command/dev`, `sync/state`

Semua payload JSON UTF-8.

---

## 1. Topics

| Topic | Arah | QoS | Retain | Keterangan |
|-------|------|-----|--------|------------|
| `pertamina/sfm/{id}/telemetry/live` | device → broker | 0 | Tidak | Flowrate (+ odometer opsional) 1 detik, tidak ke tabel telemetry |
| `pertamina/sfm/{id}/telemetry/minute` | device → broker | 1 | Tidak | Rata-rata 1 menit, masuk DB |
| `pertamina/sfm/{id}/telemetry/backlog` | device → broker | 1 | Tidak | Batch menit yang terlewat saat offline |
| `pertamina/sfm/{id}/status/valve` | device → broker | 1 | Ya | Posisi valve aktual |
| `pertamina/sfm/{id}/status/heartbeat` | device → broker | 0 | Tidak | Setiap 30 detik |
| `pertamina/sfm/{id}/status/lwt` | broker / device | 1 | Ya | LWT `offline`; setelah connect publish `online` |
| `pertamina/sfm/{id}/command/valve` | server → device | 1 | Tidak | Buka/tutup sekarang |
| `pertamina/sfm/{id}/command/dev` | server → device | 1 | Tidak | Developer mode: nyalakan hybrid Access Point |
| `pertamina/sfm/{id}/command/config` | server → device | 1 | Ya | Limit, jadwal, mode |
| `pertamina/sfm/{id}/command/config/ack` | device → broker | 1 | Tidak | Config sudah tertanam di flash |
| `pertamina/sfm/{id}/sync/state` | server → device | 1 | Tidak | Handshake reconnect (`last_recorded_at` + `last_seq` + config) |

---

## 2. Payload

### `telemetry/live`

Setiap 1 detik. Tidak disimpan di database.

```json
{
  "ts": "2026-08-18T15:00:42Z",
  "flowrate": 25.3,
  "odometer": 250123.5
}
```

| Field | Tipe | Satuan |
|-------|------|--------|
| `ts` | string ISO-8601 | waktu sample |
| `flowrate` | number | L/min |
| `odometer` | number (opsional) | liter kumulatif; untuk tampilan realtime. Tidak ke `TelemetryReading`. |

---

### `telemetry/minute`

Setiap 1 menit. Masuk tabel `TelemetryReading`.

```json
{
  "seq": 1001,
  "recorded_at": "2026-08-18T15:01:00Z",
  "flowrate_avg": 24.8,
  "odometer": 250123.5
}
```

| Field | Tipe | Keterangan |
|-------|------|------------|
| `seq` | int | Counter monotonic, +1 tiap menit (tidak dipakai untuk window backlog) |
| `recorded_at` | string ISO-8601 | Timestamp menit |
| `flowrate_avg` | number | Rata-rata L/min selama 1 menit |
| `odometer` | number | Total liter kumulatif |

---

### `telemetry/backlog`

Saat reconnect, kirim menit yang `recorded_at` **> `last_recorded_at`** dari `sync/state`.
Jika `last_recorded_at` null, kirim semua buffer.
`seq` tetap ada di tiap reading, tidak dipakai untuk menentukan window backlog.

```json
{
  "from_seq": 1002,
  "to_seq": 1200,
  "readings": [
    {
      "seq": 1002,
      "recorded_at": "2026-08-18T15:02:00Z",
      "flowrate_avg": 25.1,
      "odometer": 250130.0
    }
  ]
}
```

---

### `status/valve`

Hanya saat valve berubah.

```json
{
  "ts": "2026-08-18T15:00:05Z",
  "valve": "open",
  "cause": "command"
}
```

| Field | Nilai |
|-------|--------|
| `valve` | `open` \| `closed` |
| `cause` | `command` \| `schedule` \| `limit` \| `manual` |

---

### `status/heartbeat`

Setiap 30 detik. Backend anggap offline jika 3 beat terlewat (~90 detik).

```json
{
  "ts": "2026-08-18T15:00:30Z",
  "uptime_s": 3600,
  "config_version": 12
}
```

---

### `status/lwt`

Will saat MQTT CONNECT (broker publish jika putus):

```json
{ "status": "offline" }
```

Setelah CONNECT sukses, device publish (retain, menimpa will):

```json
{ "status": "online" }
```

---

### `command/valve`

Perintah sekali. Jangan retain.

```json
{
  "command_id": "c-9f3a",
  "valve": "closed",
  "ts": "2026-08-18T15:00:00Z"
}
```

Device eksekusi, lalu publish `status/valve`.

---

### `command/dev`

Perintah sekali dari Topology Developer mode. Jangan retain.

```json
{
  "command_id": "c-9f3a",
  "action": "hybrid_ap",
  "enable": true,
  "ts": "2026-08-19T14:00:00Z"
}
```

| Field | Nilai |
|-------|--------|
| `action` | `hybrid_ap` |
| `enable` | `true` = nyalakan hybrid Access Point |

Device: jika `action` adalah `hybrid_ap` dan `enable` adalah `true` → nyalakan hybrid AP.

---

### `command/config`

Retain. Dashboard sumber kebenaran; device simpan ke flash.

```json
{
  "config_version": 12,
  "mode": "automatic",
  "daily_limit": 2000,
  "schedule": {
    "active": true,
    "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "openTime": "06:00",
    "closeTime": "18:00"
  }
}
```

| Field | Nilai |
|-------|--------|
| `mode` | `manual` \| `automatic` |
| `daily_limit` | liter / hari |

Mode `automatic`: device buka/tutup sendiri sesuai jadwal **setiap hari** (jam `openTime`–`closeTime`) dan tutup jika usage harian ≥ limit (jalan meski offline). Limit menang: jangan buka schedule jika usage ≥ limit.  
Mode `manual`: jadwal diabaikan; `command/valve` tetap; daily limit tetap bisa menutup valve.

`days` selalu 7 hari; dashboard tidak memilih hari.

---

### `command/config/ack`

```json
{
  "ts": "2026-08-18T15:01:10Z",
  "config_version": 12
}
```

---

### `sync/state`

Dikirim server saat device transisi ke online (LWT `online`, atau live/heartbeat setelah offline).
Firmware: kirim backlog untuk menit dengan `recorded_at` > `last_recorded_at`.
Jika `last_recorded_at` null, kirim semua buffer. Jam alat harus benar (NTP/RTC).
`last_seq` tetap dikirim untuk firmware lama; window backlog yang benar adalah waktu.

```json
{
  "last_seq": 1000,
  "last_recorded_at": "2026-08-20T00:05:00.000Z",
  "config_version": 12,
  "mode": "automatic",
  "daily_limit": 2000,
  "schedule": {
    "active": true,
    "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "openTime": "06:00",
    "closeTime": "18:00"
  }
}
```

---

## 3. Struktur database (PostgreSQL)

Sumber: `backend/prisma/schema.prisma`

```
User 1───* RefreshToken
User 1───* SystemLog
Node 1───* Node (parent / children)
Node 1───* TelemetryReading
Node 1───* DeviceLog
```

### Enum

| Enum | Nilai |
|------|--------|
| `Role` | `super_admin`, `operator` |
| `NodeStatus` | `online`, `offline`, `warning` |
| `ValveState` | `open`, `closed` |
| `NodeMode` | `manual`, `automatic` |
| `TelemetrySource` | `minute`, `backlog` |
| `DeviceLogType` | `online`, `offline`, `valve`, `limit`, `schedule`, `system` |

### `User`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | uuid PK | |
| `email` | string unique | |
| `passwordHash` | string | bcrypt |
| `name` | string | |
| `role` | Role | |
| `createdAt` | datetime | |

### `RefreshToken`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | uuid PK | |
| `tokenHash` | string unique | SHA-256 refresh token |
| `userId` | uuid FK → User | cascade delete |
| `expiresAt` | datetime | 7 hari |
| `createdAt` | datetime | |

### `Node`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | uuid PK | ID di API / UI |
| `deviceId` | string unique | Path MQTT, mis. `sfm-001` |
| `name` | string | |
| `location` | string | |
| `parentId` | uuid nullable FK → Node | Tree topology |
| `status` | NodeStatus | default `offline` |
| `valveState` | ValveState | default `closed` |
| `mode` | NodeMode | default `manual` |
| `dailyLimit` | float | Liter / hari |
| `schedule` | jsonb | `{ active, days: all 7 days, openTime, closeTime }` — UI sets times only; applies every day |
| `lastSeenAt` | datetime nullable | Update dari heartbeat / telemetry |
| `lastOdometer` | float | Cache odometer terakhir |
| `lastFlowrate` | float | Cache flowrate terakhir |
| `lastTelemetrySeq` | int | Cache seq menit terakhir (legacy `last_seq`) |
| `configVersion` | int | Versi config dashboard |
| `configAckedVersion` | int | Versi terakhir yang di-ACK alat |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

Belum sinkron jika `configVersion > configAckedVersion`.

### `TelemetryReading`

Data 1 menit + backlog. **Live 1 detik tidak masuk tabel ini.**

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | uuid PK | |
| `nodeId` | uuid FK → Node | cascade delete |
| `recordedAt` | datetime | Unique bersama `nodeId` |
| `flowrateAvg` | float | L/min |
| `odometer` | float | Total liter |
| `seq` | int | Sequence device |
| `source` | TelemetrySource | `minute` atau `backlog` |
| `createdAt` | datetime | Waktu insert server |

Constraint: `UNIQUE(nodeId, recordedAt)` — duplikat backlog diabaikan.  
Index: `(nodeId, recordedAt DESC)`.

### `DeviceLog`

Event dari hardware (online/offline, valve, limit, schedule).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | uuid PK | |
| `nodeId` | uuid FK → Node | cascade delete |
| `type` | DeviceLogType | |
| `action` | string | |
| `description` | string | |
| `createdAt` | datetime | |

### `SystemLog`

Audit user (login, add node, kontrol valve dari dashboard).

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | uuid PK | |
| `userId` | uuid nullable FK → User | set null jika user dihapus |
| `action` | string | |
| `description` | string | |
| `createdAt` | datetime | |

---

## 4. Catatan firmware

1. Timer 1 detik → `telemetry/live` (`flowrate` + `odometer` opsional)
2. Timer 1 menit → hitung rata-rata, `seq++`, simpan buffer, publish `telemetry/minute`
3. Valve berubah → `status/valve` retain
4. CONNECT: LWT `status/lwt=offline` retain; setelah connect publish `online`; heartbeat 30 detik
5. Subscribe `command/valve`, `command/config`, `command/dev`, `sync/state`
6. Config di flash; enforce jadwal + daily limit lokal (termasuk saat offline). Daily usage = delta odometer; reset tiap 00:00 Asia/Jakarta. Limit menang atas schedule.
7. Reconnect: backlog jika `recorded_at` > `last_recorded_at` (null = kirim semua buffer). Jam alat harus NTP/RTC.
8. Setelah reconnect (bersamaan/setelah `status/lwt=online`), device **wajib republish** `status/valve` retain dengan posisi aktual + `cause` terakhir, supaya dashboard tidak miskom jika schedule/limit mengubah valve saat offline.
9. Buffer lokal minimal 24–48 jam data 1 menit (~1440–2880 record)
10. `command/dev` `action=hybrid_ap` `enable=true` → nyalakan hybrid Access Point (satu kali, tidak retain)
