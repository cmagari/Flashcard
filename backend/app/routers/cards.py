from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_session
from ..models import Attempt, Card, Subject, Tag, card_tags
from ..schemas import (
    AttemptOut,
    CardCreate,
    CardOut,
    CardSummary,
    CardUpdate,
    TagAttach,
)
from .tags import get_or_create_tag

router = APIRouter(prefix="/api/cards", tags=["cards"])


def _summary(c: Card) -> CardSummary:
    return CardSummary(
        id=c.id,
        subject_id=c.subject_id,
        subject_name=c.subject.name if c.subject else "",
        front_md=c.front_md,
        back_md=c.back_md,
        tags=[t.name for t in c.tags],
        is_draft=c.is_draft,
        updated_at=c.updated_at,
    )


def _full(c: Card) -> CardOut:
    last10 = [
        AttemptOut(id=a.id, result=a.result.value, created_at=a.created_at)
        for a in c.attempts[:10]
    ]
    return CardOut(
        id=c.id,
        subject_id=c.subject_id,
        subject_name=c.subject.name if c.subject else "",
        front_md=c.front_md,
        back_md=c.back_md,
        tags=[t.name for t in c.tags],
        is_draft=c.is_draft,
        created_at=c.created_at,
        updated_at=c.updated_at,
        last10_attempts=last10,
    )


@router.get("", response_model=list[CardSummary])
def list_cards(
    subject_id: int | None = None,
    tag_ids: list[int] | None = Query(default=None),
    q: str | None = None,
    draft: bool | None = Query(
        default=None,
        description="true = drafts only, false = finished only, omitted = both",
    ),
    session: Session = Depends(get_session),
) -> list[CardSummary]:
    stmt = (
        select(Card)
        .options(selectinload(Card.subject), selectinload(Card.tags))
        .order_by(Card.updated_at.desc())
    )
    if subject_id is not None:
        stmt = stmt.where(Card.subject_id == subject_id)
    if draft is not None:
        stmt = stmt.where(Card.is_draft.is_(draft))
    if tag_ids:
        # cards that have ALL requested tags
        for tid in tag_ids:
            sub = select(card_tags.c.card_id).where(card_tags.c.tag_id == tid)
            stmt = stmt.where(Card.id.in_(sub))
    if q:
        like = f"%{q}%"
        # match in front, back, subject name, or tag name
        subj_match = select(Subject.id).where(Subject.name.ilike(like))
        tag_match = (
            select(card_tags.c.card_id)
            .join(Tag, Tag.id == card_tags.c.tag_id)
            .where(Tag.name.ilike(like))
        )
        stmt = stmt.where(
            or_(
                Card.front_md.ilike(like),
                Card.back_md.ilike(like),
                Card.subject_id.in_(subj_match),
                Card.id.in_(tag_match),
            )
        )
    cards = session.execute(stmt).unique().scalars().all()
    return [_summary(c) for c in cards]


def _apply_tags(session: Session, card: Card, tag_names: list[str]) -> None:
    seen: set[str] = set()
    new_tags: list[Tag] = []
    for raw in tag_names:
        name = raw.strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        new_tags.append(get_or_create_tag(session, name))
    card.tags = new_tags


@router.post("", response_model=CardOut, status_code=status.HTTP_201_CREATED)
def create_card(payload: CardCreate, session: Session = Depends(get_session)) -> CardOut:
    if not session.get(Subject, payload.subject_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Subject not found")
    card = Card(
        subject_id=payload.subject_id,
        front_md=payload.front_md,
        back_md=payload.back_md,
        is_draft=payload.is_draft,
    )
    session.add(card)
    session.flush()
    _apply_tags(session, card, payload.tag_names)
    session.commit()
    session.refresh(card)
    return _full(card)


@router.get("/{card_id}", response_model=CardOut)
def get_card(card_id: int, session: Session = Depends(get_session)) -> CardOut:
    card = session.execute(
        select(Card)
        .where(Card.id == card_id)
        .options(
            selectinload(Card.subject),
            selectinload(Card.tags),
            selectinload(Card.attempts),
        )
    ).unique().scalar_one_or_none()
    if not card:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return _full(card)


@router.patch("/{card_id}", response_model=CardOut)
def update_card(
    card_id: int, payload: CardUpdate, session: Session = Depends(get_session)
) -> CardOut:
    card = session.get(Card, card_id)
    if not card:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if payload.subject_id is not None:
        if not session.get(Subject, payload.subject_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Subject not found")
        card.subject_id = payload.subject_id
    if payload.front_md is not None:
        card.front_md = payload.front_md
    if payload.back_md is not None:
        card.back_md = payload.back_md
    if payload.tag_names is not None:
        _apply_tags(session, card, payload.tag_names)
    if payload.is_draft is not None:
        card.is_draft = payload.is_draft
    session.commit()
    session.refresh(card)
    return _full(card)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(card_id: int, session: Session = Depends(get_session)) -> None:
    card = session.get(Card, card_id)
    if not card:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    session.delete(card)
    session.commit()


@router.post("/{card_id}/tags", response_model=CardOut)
def attach_tag(
    card_id: int, payload: TagAttach, session: Session = Depends(get_session)
) -> CardOut:
    card = session.get(Card, card_id)
    if not card:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    tag = get_or_create_tag(session, payload.name)
    if tag not in card.tags:
        card.tags.append(tag)
        session.commit()
    session.refresh(card)
    return _full(card)


@router.delete("/{card_id}/tags/{tag_id}", response_model=CardOut)
def detach_tag(
    card_id: int, tag_id: int, session: Session = Depends(get_session)
) -> CardOut:
    card = session.get(Card, card_id)
    if not card:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    tag = session.get(Tag, tag_id)
    if tag and tag in card.tags:
        card.tags.remove(tag)
        session.commit()
    session.refresh(card)
    return _full(card)
