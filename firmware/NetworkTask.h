#pragma once

#include "types.h"

bool NetworkTask_mqttReady();
bool NetworkTask_publishJson(const char* suffix, const char* payload, bool retain,
                             int qos);
bool NetworkTask_publishRecord(const SensorRecord* rec, bool backlog);
void NetworkTask(void* arg);
