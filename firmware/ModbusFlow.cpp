#include "ModbusFlow.h"

#include "AppConfig.h"

static HardwareSerial RS485Serial(1);

static const uint8_t kModbusRequest[] = {
    0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B};

static uint16_t crc16Modbus(const uint8_t* buf, uint16_t len) {
  uint16_t crc = 0xFFFF;
  for (uint16_t i = 0; i < len; i++) {
    crc ^= buf[i];
    for (uint8_t b = 0; b < 8; b++) {
      if (crc & 1) {
        crc = (uint16_t)((crc >> 1) ^ 0xA001);
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

static void drainRx() {
  while (RS485Serial.available()) {
    RS485Serial.read();
  }
}

void ModbusFlow_purgeBus() {
  const uint32_t started = millis();
  uint32_t lastByteMs = millis();
  drainRx();
  lastByteMs = millis();

  for (;;) {
    if (RS485Serial.available()) {
      RS485Serial.read();
      lastByteMs = millis();
    } else if ((millis() - lastByteMs) >= MODBUS_PURGE_QUIET_MS) {
      return;
    }

    if ((millis() - started) >= MODBUS_PURGE_MAX_MS) {
      drainRx();
      return;
    }
    vTaskDelay(1);
  }
}

static bool waitFullFrame(uint8_t* resp) {
  const uint32_t start = millis();
  uint8_t lastCount = 0;
  uint32_t lastProgress = start;

  while (RS485Serial.available() < MODBUS_RESPONSE_LEN) {
    const uint8_t n = (uint8_t)RS485Serial.available();
    const uint32_t now = millis();

    if (n > lastCount) {
      lastCount = n;
      lastProgress = now;
    }

    if (lastCount == 0) {
      if ((now - start) > MODBUS_TIMEOUT_MS) {
        return false;
      }
    } else {
      if ((now - lastProgress) > MODBUS_INTERBYTE_MS) {
        return false;
      }
      if ((now - start) > (MODBUS_TIMEOUT_MS + MODBUS_RX_GRACE_MS)) {
        return false;
      }
    }
    vTaskDelay(1);
  }

  for (uint8_t i = 0; i < MODBUS_RESPONSE_LEN; i++) {
    resp[i] = (uint8_t)RS485Serial.read();
  }
  return true;
}

static RecordStatus parseFrame(const uint8_t* resp, uint16_t* flow_raw,
                               uint16_t* volume_raw) {
  if (resp[0] != MODBUS_SLAVE_ID || resp[1] != 0x03 || resp[2] != 0x04) {
    return MODBUS_BAD_FRAME;
  }

  const uint16_t crcCalc = crc16Modbus(resp, 7);
  const uint16_t crcWire = (uint16_t)(resp[7] | (resp[8] << 8));
  if (crcCalc != crcWire) {
    return MODBUS_BAD_FRAME;
  }

  if (flow_raw) {
    *flow_raw = (uint16_t)((resp[3] << 8) | resp[4]);
  }
  if (volume_raw) {
    *volume_raw = (uint16_t)((resp[5] << 8) | resp[6]);
  }
  return RECORD_OK;
}

static bool takeLeftoverFrame(uint16_t* flow_raw, uint16_t* volume_raw,
                              RecordStatus* out) {
  if (RS485Serial.available() < MODBUS_RESPONSE_LEN) {
    return false;
  }
  uint8_t resp[MODBUS_RESPONSE_LEN];
  for (uint8_t i = 0; i < MODBUS_RESPONSE_LEN; i++) {
    resp[i] = (uint8_t)RS485Serial.read();
  }
  *out = parseFrame(resp, flow_raw, volume_raw);
  return *out == RECORD_OK;
}

static RecordStatus attemptOnce(uint16_t* flow_raw, uint16_t* volume_raw) {
  RS485Serial.write(kModbusRequest, sizeof(kModbusRequest));

  uint8_t resp[MODBUS_RESPONSE_LEN];
  if (!waitFullFrame(resp)) {
    return MODBUS_TIMEOUT;
  }
  return parseFrame(resp, flow_raw, volume_raw);
}

void ModbusFlow_begin() {
  RS485Serial.setRxBufferSize(256);
  RS485Serial.begin(RS485_BAUD, SERIAL_8N1, RS485_RX, RS485_TX);
  delay(RS485_SETTLE_MS);
  drainRx();
}

bool ModbusFlow_warmup() {
  for (uint8_t i = 0; i < MODBUS_WARMUP_TRIES; i++) {
    uint16_t flow = 0;
    uint16_t volume = 0;
    ModbusFlow_purgeBus();
    const RecordStatus st = attemptOnce(&flow, &volume);
    Serial.printf("[boot] Modbus warmup %u/%u st=%u\n", (unsigned)(i + 1),
                  (unsigned)MODBUS_WARMUP_TRIES, (unsigned)st);
    if (st == RECORD_OK) {
      return true;
    }
    ModbusFlow_purgeBus();
    delay(MODBUS_WARMUP_GAP_MS);
  }
  return false;
}

void ModbusFlow_read(uint16_t* flow_raw, uint16_t* volume_raw,
                     RecordStatus* status) {
  if (flow_raw) {
    *flow_raw = 0;
  }
  if (volume_raw) {
    *volume_raw = 0;
  }

  RecordStatus leftover = MODBUS_TIMEOUT;
  if (takeLeftoverFrame(flow_raw, volume_raw, &leftover)) {
    if (status) {
      *status = RECORD_OK;
    }
    ModbusFlow_purgeBus();
    return;
  }

  ModbusFlow_purgeBus();

  const uint32_t cycleStart = millis();
  RecordStatus last = attemptOnce(flow_raw, volume_raw);
  if (last == RECORD_OK) {
    if (status) {
      *status = RECORD_OK;
    }
    return;
  }

  const bool inStartup = millis() < MODBUS_STARTUP_RETRY_MS;
  const bool roomForRetry =
      (millis() - cycleStart) < (SAMPLE_PERIOD_MS / 2);
  if (inStartup && MODBUS_RETRY_MAX > 0 && roomForRetry) {
    ModbusFlow_purgeBus();
    last = attemptOnce(flow_raw, volume_raw);
  }

  if (status) {
    *status = last;
  }
}
