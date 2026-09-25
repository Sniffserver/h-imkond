#include "nvs.h"
#include <string.h>

bool hoimu_nvs_init(void) {
    return true;
}

bool hoimu_nvs_write(const char *key, const void *data, size_t len) {
    (void)key;
    (void)data;
    (void)len;
    return true;
}

bool hoimu_nvs_read(const char *key, void *out_data, size_t max_len, size_t *read_len) {
    (void)key;
    (void)out_data;
    (void)max_len;
    if (read_len) *read_len = 0;
    return false;
}
