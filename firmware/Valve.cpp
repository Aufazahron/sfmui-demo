#include "Valve.h"

#include "AppConfig.h"

void Valve_begin() {
  pinMode(VALVE_RELAY_PIN, OUTPUT);
  Valve_apply(VALVE_CLOSED);
}

void Valve_apply(ValveState state) {
  const bool open = (state == VALVE_OPEN);
#if VALVE_OPEN_LEVEL
  digitalWrite(VALVE_RELAY_PIN, open ? RELAY_ON : RELAY_OFF);
#else
  digitalWrite(VALVE_RELAY_PIN, open ? RELAY_OFF : RELAY_ON);
#endif
}

ValveState Valve_read() {
  const int level = digitalRead(VALVE_RELAY_PIN);
#if VALVE_OPEN_LEVEL
  return level == RELAY_ON ? VALVE_OPEN : VALVE_CLOSED;
#else
  return level == RELAY_OFF ? VALVE_OPEN : VALVE_CLOSED;
#endif
}
