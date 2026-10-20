#pragma once

#include <Arduino.h>
#include "types.h"

void ModbusFlow_begin();
void ModbusFlow_purgeBus();
bool ModbusFlow_warmup();
void ModbusFlow_read(uint16_t* flow_raw, uint16_t* volume_raw,
                     RecordStatus* status);
