from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_session
from ..models import Attempt, AttemptResult, Card, card_tags
from ..schemas import AttemptCreate, CardOut
from ..smart import CardStats, pick_weighted, weight_for
from .cards import _full

router = APIRouter(prefix="/api/practice", tags=["practice"])

LAST_N = 10


def _filtered_cards_query(
    session: Session,
    subject_ids: list[int],
    tag_ids: list[int],
):
    stmt = select(Card).options(
        selectinload(Card.subject),
        selectinload(Card.tags),
        selectinload(Card.attempts),
    )
    if subject_ids:
        stmt = stmt.where(Card.subject_id.in_(subject_ids))
    if tag_ids:
        for tid in tag_ids:
            sub = select(card_tags.c.card_id).where(card_tags.c.tag_id == tid)
            stmt = stmt.where(Card.id.in_(sub))
    return stmt


@router.get("/next", response_model=CardOut | None)
def next_card(
    mode: str = "random",
    subject_id: int | None = None,
    subject_ids: list[int] | None = Query(default=None),
    tag_ids: list[int] | None = Query(default=None),
    cursor_id: int | None = None,
    exclude_ids: list[int] | None = Query(default=None),
    session: Session = Depends(get_session),
):
    if mode not in {"random", "inorder", "smart"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid mode")

    # subject_ids (multi-select) takes precedence; fall back to the legacy
    # single subject_id so older callers keep working.
    subjects = list(subject_ids or [])
    if not subjects and subject_id is not None:
        subjects = [subject_id]

    stmt = _filtered_cards_query(session, subjects, tag_ids or [])
    if exclude_ids:
        stmt = stmt.where(Card.id.notin_(exclude_ids))

    if mode == "inorder":
        stmt = stmt.order_by(Card.created_at.asc(), Card.id.asc())
        if cursor_id is not None:
            cur = session.get(Card, cursor_id)
            if cur:
                stmt = stmt.where(
                    (Card.created_at > cur.created_at)
                    | ((Card.created_at == cur.created_at) & (Card.id > cur.id))
                )
        card = session.execute(stmt.limit(1)).unique().scalar_one_or_none()
        return _full(card) if card else None

    cards = session.execute(stmt).unique().scalars().all()
    if not cards:
        return None

    if mode == "random":
        return _full(random.choice(cards))

    # smart
    now = datetime.now(timezone.utc)
    ids: list[int] = []
    weights: list[float] = []
    for c in cards:
        last10 = list(c.attempts[:LAST_N])
        stats = CardStats(card_id=c.id, last10=last10, now=now)
        ids.append(c.id)
        weights.append(weight_for(stats))
    chosen_id = pick_weighted(ids, weights)
    chosen = next(c for c in cards if c.id == chosen_id)
    return _full(chosen)


@router.post("/attempt", response_model=CardOut)
def record_attempt(
    payload: AttemptCreate, session: Session = Depends(get_session)
) -> CardOut:
    card = session.get(Card, payload.card_id)
    if not card:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    attempt = Attempt(card_id=card.id, result=AttemptResult(payload.result))
    session.add(attempt)
    session.flush()

    # trim to last N
    keep_ids = (
        session.execute(
            select(Attempt.id)
            .where(Attempt.card_id == card.id)
            .order_by(Attempt.created_at.desc(), Attempt.id.desc())
            .limit(LAST_N)
        )
        .scalars()
        .all()
    )
    if keep_ids:
        session.execute(
            select(Attempt).where(
                Attempt.card_id == card.id, Attempt.id.notin_(keep_ids)
            )
        )
        # delete out-of-window attempts
        for old in (
            session.execute(
                select(Attempt).where(
                    Attempt.card_id == card.id, Attempt.id.notin_(keep_ids)
                )
            )
            .scalars()
            .all()
        ):
            session.delete(old)
    session.commit()
    session.refresh(card)
    return _full(card)
