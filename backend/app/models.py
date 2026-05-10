from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


card_tags = Table(
    "card_tags",
    Base.metadata,
    Column("card_id", ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)

    cards: Mapped[list["Card"]] = relationship(
        back_populates="subject", cascade="all, delete-orphan", passive_deletes=True
    )


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    front_md: Mapped[str] = mapped_column(Text, nullable=False, default="")
    back_md: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow, nullable=False
    )

    subject: Mapped[Subject] = relationship(back_populates="cards")
    tags: Mapped[list["Tag"]] = relationship(secondary=card_tags, back_populates="cards")
    attempts: Mapped[list["Attempt"]] = relationship(
        back_populates="card",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Attempt.created_at.desc()",
    )

    __table_args__ = (
        Index("ix_cards_subject_id", "subject_id"),
        Index("ix_cards_updated_at", "updated_at"),
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    cards: Mapped[list[Card]] = relationship(secondary=card_tags, back_populates="tags")


class AttemptResult(str, enum.Enum):
    correct = "correct"
    incorrect = "incorrect"


class Attempt(Base):
    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("cards.id", ondelete="CASCADE"), nullable=False
    )
    result: Mapped[AttemptResult] = mapped_column(
        Enum(AttemptResult, name="attempt_result"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)

    card: Mapped[Card] = relationship(back_populates="attempts")

    __table_args__ = (
        Index("ix_attempts_card_id_created_at", "card_id", "created_at"),
    )


class Image(Base):
    __tablename__ = "images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    ext: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("id", "ext", name="uq_images_id_ext"),)
