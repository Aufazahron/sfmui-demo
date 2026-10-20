#pragma once

#include "types.h"

bool Journal_begin();
bool Journal_append(const SensorRecord* rec);
bool Journal_readNext(JournalMeta* meta, SensorRecord* rec, bool* eof);
void Journal_loadMeta(JournalMeta* meta);
void Journal_saveMeta(const JournalMeta* meta);
void Journal_touchSequence(uint32_t seq);
void Journal_touchAck(uint32_t ack);
void Journal_touchSync(uint32_t day, uint32_t offset);
uint32_t Journal_dayFromUnix(uint32_t unixTime);
