"""Smart-mode scoring algorithm for flashcard selection.

Weights cards by recency (longer since seen = higher weight) and performance
(fewer correct answers in last 10 attempts = higher weight). Never-seen cards
get a flat bonus so new material surfaces but doesn't dominate.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from .models import AttemptResult

RECENCY_DIVISOR_DAYS = 7.0
RECENCY_CAP = 5.0
PERFORMANCE_MULTIPLIER = 3.0
NEVER_SEEN_BONUS = 2.0
BASE_WEIGHT = 1.0


class AttemptLike(Protocol):
    result: AttemptResult
    created_at: datetime


@dataclass
class CardStats:
    card_id: int
    last10: list[AttemptLike]
    now: datetime

    @property
    def correct_ratio(self) -> float:
        if not self.last10:
            return 0.0
        correct = sum(1 for a in self.last10 if a.result == AttemptResult.correct)
        return correct / len(self.last10)

    @property
    def days_since_seen(self) -> float:
        if not self.last10:
            return float("inf")
        last = max(a.created_at for a in self.last10)
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        now = self.now if self.now.tzinfo else self.now.replace(tzinfo=timezone.utc)
        return max(0.0, (now - last).total_seconds() / 86400.0)


def weight_for(stats: CardStats) -> float:
    if not stats.last10:
        return BASE_WEIGHT + RECENCY_CAP + NEVER_SEEN_BONUS
    recency = min(stats.days_since_seen / RECENCY_DIVISOR_DAYS, RECENCY_CAP)
    performance = (1.0 - stats.correct_ratio) * PERFORMANCE_MULTIPLIER
    return BASE_WEIGHT + recency + performance


def pick_weighted(card_ids: list[int], weights: list[float], rng: random.Random | None = None) -> int:
    if not card_ids:
        raise ValueError("card_ids must be non-empty")
    r = rng or random
    return r.choices(card_ids, weights=weights, k=1)[0]
