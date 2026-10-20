#pragma once

#include <stddef.h>
#include <stdint.h>

void Proto_formatIsoUtc(char* buf, size_t len, uint32_t unixUtc);
uint32_t Proto_wibDayKey(uint32_t unixUtc);
void Proto_wibHms(uint32_t unixUtc, int* hour, int* minute, int* wdayMon0);
bool Proto_isoGreater(const char* a, const char* b);
