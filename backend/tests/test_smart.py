from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from dataclasses import dataclass

from app.models import AttemptResult
from app.smart import CardStats, pick_weighted, weight_for


@dataclass
class _A:
    result: AttemptResult
    created_at: datetime


def _attempt(result: AttemptResult, days_ago: float, now: datetime) -> _A:
    return _A(result=result, created_at=now - timedelta(days=days_ago))


def test_never_seen_card_has_high_weight():
    now = datetime.now(timezone.utc)
    stats = CardStats(card_id=1, last10=[], now=now)
    assert weight_for(stats) == 1.0 + 5.0 + 2.0  # base + cap + bonus


def test_recently_correct_card_has_low_weight():
    now = datetime.now(timezone.utc)
    last10 = [_attempt(AttemptResult.correct, 0.5, now)] * 9 + [
        _attempt(AttemptResult.incorrect, 0.5, now)
    ]
    stats = CardStats(card_id=2, last10=last10, now=now)
    w = weight_for(stats)
    # recency ~ 0.07, performance = (1 - 0.9) * 3 = 0.3
    assert 1.3 < w < 1.5


def test_old_and_bad_card_has_high_weight():
    now = datetime.now(timezone.utc)
    last10 = [_attempt(AttemptResult.incorrect, 30, now)] * 8 + [
        _attempt(AttemptResult.correct, 30, now)
    ] * 2
    stats = CardStats(card_id=3, last10=last10, now=now)
    w = weight_for(stats)
    # recency = 30/7 ≈ 4.286, performance = (1 - 0.2) * 3 = 2.4
    assert 7.5 < w < 7.8


def test_smart_distribution_favors_old_and_bad():
    now = datetime.now(timezone.utc)
    rng = random.Random(42)
    cards = {
        "fresh_perfect": weight_for(
            CardStats(
                card_id=1,
                last10=[_attempt(AttemptResult.correct, 0, now)] * 10,
                now=now,
            )
        ),
        "old_bad": weight_for(
            CardStats(
                card_id=2,
                last10=[_attempt(AttemptResult.incorrect, 60, now)] * 10,
                now=now,
            )
        ),
        "never_seen": weight_for(CardStats(card_id=3, last10=[], now=now)),
    }
    ids = list(cards.keys())
    weights = list(cards.values())
    counts = {k: 0 for k in ids}
    for _ in range(1000):
        chosen = rng.choices(ids, weights=weights, k=1)[0]
        counts[chosen] += 1
    assert counts["old_bad"] > counts["fresh_perfect"] * 3
    assert counts["never_seen"] > counts["fresh_perfect"]


def test_pick_weighted_respects_weights():
    rng = random.Random(0)
    # Force: card 1 weight 0, card 2 weight 1 → always 2
    chosen = [pick_weighted([1, 2], [0.0, 1.0], rng) for _ in range(50)]
    assert all(c == 2 for c in chosen)
