from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Tag, card_tags
from ..schemas import TagOut

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(session: Session = Depends(get_session)) -> list[TagOut]:
    counts = dict(
        session.execute(
            select(card_tags.c.tag_id, func.count()).group_by(card_tags.c.tag_id)
        ).all()
    )
    tags = session.execute(select(Tag).order_by(Tag.name)).scalars().all()
    return [TagOut(id=t.id, name=t.name, usage_count=counts.get(t.id, 0)) for t in tags]


def get_or_create_tag(session: Session, name: str) -> Tag:
    name = name.strip()
    existing = session.execute(select(Tag).where(Tag.name == name)).scalar_one_or_none()
    if existing:
        return existing
    t = Tag(name=name)
    session.add(t)
    session.flush()
    return t
