from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Card, Subject
from ..schemas import SubjectCreate, SubjectOut, SubjectUpdate

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


def _serialize(s: Subject, card_count: int) -> SubjectOut:
    return SubjectOut(
        id=s.id,
        name=s.name,
        description=s.description,
        include_in_general_practice=s.include_in_general_practice,
        created_at=s.created_at,
        card_count=card_count,
    )


@router.get("", response_model=list[SubjectOut])
def list_subjects(session: Session = Depends(get_session)) -> list[SubjectOut]:
    counts = dict(
        session.execute(
            select(Card.subject_id, func.count(Card.id)).group_by(Card.subject_id)
        ).all()
    )
    subjects = session.execute(select(Subject).order_by(Subject.name)).scalars().all()
    return [_serialize(s, counts.get(s.id, 0)) for s in subjects]


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(payload: SubjectCreate, session: Session = Depends(get_session)) -> SubjectOut:
    name = payload.name.strip()
    if session.execute(select(Subject).where(Subject.name == name)).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Subject with that name already exists")
    s = Subject(
        name=name,
        description=payload.description.strip(),
        include_in_general_practice=payload.include_in_general_practice,
    )
    session.add(s)
    session.commit()
    session.refresh(s)
    return _serialize(s, 0)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int, payload: SubjectUpdate, session: Session = Depends(get_session)
) -> SubjectOut:
    s = session.get(Subject, subject_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if payload.name is not None:
        new_name = payload.name.strip()
        if new_name != s.name and session.execute(
            select(Subject).where(Subject.name == new_name)
        ).scalar_one_or_none():
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Subject with that name already exists")
        s.name = new_name
    if payload.description is not None:
        s.description = payload.description.strip()
    if payload.include_in_general_practice is not None:
        s.include_in_general_practice = payload.include_in_general_practice
    session.commit()
    session.refresh(s)
    count = session.execute(
        select(func.count(Card.id)).where(Card.subject_id == s.id)
    ).scalar_one()
    return _serialize(s, count)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(subject_id: int, session: Session = Depends(get_session)) -> None:
    s = session.get(Subject, subject_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    session.delete(s)
    session.commit()
