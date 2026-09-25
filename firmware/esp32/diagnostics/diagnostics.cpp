#include "diagnostics.h"

hoimu_diagnostics_report_t hoimu_diagnostics_get_report(void) {
    hoimu_diagnostics_report_t report;
    report.free_heap_bytes = 240000;
    report.uptime_seconds = 3600;
    report.last_rssi = -82;
    report.last_snr = 8;
    report.battery_percent = 95;
    return report;
}
