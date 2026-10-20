#pragma once

#include "types.h"

void Valve_begin();
void Valve_apply(ValveState state);
ValveState Valve_read();
