from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_session
from ..mastery import MasteryLevel, classify
from ..models import Card, Subject
from ..schemas import (
    HomeStats,
    HomeTotals,
    ReviewCard,
    SubjectMastery,
)
from ..smart import CardStats, weight_for

router = APIRouter(prefix="/api/stats", tags=["stats"])

LAST_N = 10
REVIEW_QUEUE_SIZE = 8


@router.get("/home", response_model=HomeStats)
def home(session: Session = Depends(get_session)) -> HomeStats:
    now = datetime.now(timezone.utc)

    subjects = (
        session.execute(select(Subject).order_by(Subject.name.asc()))
        .scalars()
        .all()
    )
    # Drafts are excluded from practice, so counting them here would report
    # mastery for cards that can never come up — and park them permanently at
    # the top of the review queue, since an unattempted card scores highest.
    cards = (
        session.execute(
            select(Card)
            .where(Card.is_draft.is_(False))
            .options(
                selectinload(Card.subject),
                selectinload(Card.tags),
                selectinload(Card.attempts),
            )
        )
        .unique()
        .scalars()
        .all()
    )

    per_subject: dict[int, SubjectMastery] = {
        s.id: SubjectMastery(id=s.id, name=s.name, card_count=0)
        for s in subjects
    }
    draft_count = session.execute(
        select(func.count(Card.id)).where(Card.is_draft.is_(True))
    ).scalar_one()

    totals = HomeTotals(
        subjects=len(subjects), cards=len(cards), drafts=draft_count
    )
    candidates: list[tuple[float, Card, MasteryLevel]] = []

    for c in cards:
        last10 = list(c.attempts[:LAST_N])
        stats = CardStats(card_id=c.id, last10=last10, now=now)
        level = classify(stats)
        weight = weight_for(stats)

        bucket = per_subject.get(c.subject_id)
        if bucket is None:
            bucket = SubjectMastery(id=c.subject_id, name=c.subject.name if c.subject else "", card_count=0)
            per_subject[c.subject_id] = bucket
        bucket.card_count += 1
        _bump(bucket, level)
        _bump(totals, level)

        candidates.append((weight, c, level))

    candidates.sort(key=lambda t: t[0], reverse=True)
    needs_review = [
        ReviewCard(
            id=c.id,
            subject_id=c.subject_id,
            subject_name=c.subject.name if c.subject else "",
            front_md=c.front_md,
            tags=[t.name for t in c.tags],
            weight=round(w, 3),
            mastery=level.value,
        )
        for w, c, level in candidates[:REVIEW_QUEUE_SIZE]
    ]

    return HomeStats(
        totals=totals,
        subjects=list(per_subject.values()),
        needs_review=needs_review,
    )


def _bump(bucket, level: MasteryLevel) -> None:
    if level is MasteryLevel.memorized:
        bucket.memorized += 1
    elif level is MasteryLevel.familiar:
        bucket.familiar += 1
    elif level is MasteryLevel.learning:
        bucket.learning += 1
    else:
        bucket.new += 1
