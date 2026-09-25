#include "outbox.h"
#include <string.h>

#define OUTBOX_CAPACITY 32

static hoimu_frame_t g_outbox_ring[OUTBOX_CAPACITY];
static size_t g_outbox_head = 0;
static size_t g_outbox_tail = 0;
static size_t g_outbox_size = 0;

void hoimu_outbox_init(void) {
    g_outbox_head = 0;
    g_outbox_tail = 0;
    g_outbox_size = 0;
}

bool hoimu_outbox_enqueue(const hoimu_frame_t *frame) {
    if (!frame || g_outbox_size >= OUTBOX_CAPACITY) return false;
    g_outbox_ring[g_outbox_tail] = *frame;
    g_outbox_tail = (g_outbox_tail + 1) % OUTBOX_CAPACITY;
    g_outbox_size++;
    return true;
}

bool hoimu_outbox_dequeue(hoimu_frame_t *out_frame) {
    if (!out_frame || g_outbox_size == 0) return false;
    *out_frame = g_outbox_ring[g_outbox_head];
    g_outbox_head = (g_outbox_head + 1) % OUTBOX_CAPACITY;
    g_outbox_size--;
    return true;
}

size_t hoimu_outbox_count(void) {
    return g_outbox_size;
}
