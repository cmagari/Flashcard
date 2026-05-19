from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.mastery import MasteryLevel, classify
from app.models import AttemptResult
from app.smart import CardStats


@dataclass
class _A:
    result: AttemptResult
    created_at: datetime


def _attempts(now: datetime, results: list[AttemptResult], days_ago: float = 1.0) -> list[_A]:
    return [_A(result=r, created_at=now - timedelta(days=days_ago)) for r in results]


def _stats(now: datetime, last10: list[_A]) -> CardStats:
    return CardStats(card_id=1, last10=last10, now=now)


def test_no_attempts_is_new():
    now = datetime.now(timezone.utc)
    assert classify(_stats(now, [])) == MasteryLevel.new


def test_one_attempt_is_learning():
    now = datetime.now(timezone.utc)
    last10 = _attempts(now, [AttemptResult.correct])
    assert classify(_stats(now, last10)) == MasteryLevel.learning


def test_three_attempts_at_60pct_is_familiar():
    now = datetime.now(timezone.utc)
    last10 = _attempts(
        now,
        [AttemptResult.correct, AttemptResult.correct, AttemptResult.incorrect],
    )
    # ratio 2/3 ≈ 0.667 > 0.6
    assert classify(_stats(now, last10)) == MasteryLevel.familiar


def test_three_attempts_at_50pct_is_learning():
    now = datetime.now(timezone.utc)
    last10 = _attempts(
        now,
        [AttemptResult.correct, AttemptResult.incorrect, AttemptResult.correct, AttemptResult.incorrect],
    )
    # 4 attempts, 50% < 0.6 threshold
    assert classify(_stats(now, last10)) == MasteryLevel.learning


def test_seven_attempts_86pct_recent_is_memorized():
    now = datetime.now(timezone.utc)
    results = [AttemptResult.correct] * 6 + [AttemptResult.incorrect]  # 6/7 ≈ 0.857
    last10 = _attempts(now, results, days_ago=1.0)
    assert classify(_stats(now, last10)) == MasteryLevel.memorized


def test_seven_attempts_80pct_is_familiar_not_memorized():
    now = datetime.now(timezone.utc)
    # 8 / 10 = 0.80 < 0.85
    results = [AttemptResult.correct] * 8 + [AttemptResult.incorrect] * 2
    last10 = _attempts(now, results)
    assert classify(_stats(now, last10)) == MasteryLevel.familiar


def test_memorized_decays_to_familiar_when_stale():
    now = datetime.now(timezone.utc)
    results = [AttemptResult.correct] * 9 + [AttemptResult.incorrect]  # 0.9
    last10 = _attempts(now, results, days_ago=45.0)
    # Stale > 30 days → not memorized, but still meets familiar (n≥3, ratio≥0.6)
    assert classify(_stats(now, last10)) == MasteryLevel.familiar


def test_memorized_at_exact_thresholds():
    now = datetime.now(timezone.utc)
    # exactly 7 attempts, exactly 0.857... ≥ 0.85, exactly 30 days old
    results = [AttemptResult.correct] * 6 + [AttemptResult.incorrect]
    last10 = _attempts(now, results, days_ago=30.0)
    assert classify(_stats(now, last10)) == MasteryLevel.memorized
