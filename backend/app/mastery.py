"""Mastery classification derived from each card's last-10 attempt history."""

from __future__ import annotations

import enum

from .smart import CardStats

MEMORIZED_MIN_ATTEMPTS = 7
MEMORIZED_MIN_RATIO = 0.85
MEMORIZED_MAX_STALE_DAYS = 30.0

FAMILIAR_MIN_ATTEMPTS = 3
FAMILIAR_MIN_RATIO = 0.6


class MasteryLevel(str, enum.Enum):
    memorized = "memorized"
    familiar = "familiar"
    learning = "learning"
    new = "new"


def classify(stats: CardStats) -> MasteryLevel:
    if not stats.last10:
        return MasteryLevel.new
    n = len(stats.last10)
    ratio = stats.correct_ratio
    if (
        n >= MEMORIZED_MIN_ATTEMPTS
        and ratio >= MEMORIZED_MIN_RATIO
        and stats.days_since_seen <= MEMORIZED_MAX_STALE_DAYS
    ):
        return MasteryLevel.memorized
    if n >= FAMILIAR_MIN_ATTEMPTS and ratio >= FAMILIAR_MIN_RATIO:
        return MasteryLevel.familiar
    return MasteryLevel.learning
