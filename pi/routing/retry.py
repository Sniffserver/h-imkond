"""
Exponential Backoff & Retransmission Jitter
"""

import random

class RetryManager:
    def __init__(self, base_delay_s: float = 0.5, max_delay_s: float = 8.0, max_attempts: int = 5):
        self.base_delay_s = base_delay_s
        self.max_delay_s = max_delay_s
        self.max_attempts = max_attempts

    def get_backoff_seconds(self, attempt: int) -> float:
        """
        Calculates exponential backoff with full jitter:
        delay = Uniform(0, min(max_delay, base_delay * 2^attempt))
        """
        if attempt >= self.max_attempts:
            return -1.0 # Give up

        temp = min(self.max_delay_s, self.base_delay_s * (2 ** attempt))
        delay = random.uniform(0.1, temp)
        return round(delay, 3)

    def should_retry(self, attempt: int) -> bool:
        return attempt < self.max_attempts
