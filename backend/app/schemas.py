from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SubjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)


class SubjectOut(SubjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    card_count: int = 0


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    usage_count: int = 0


class TagAttach(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class AttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    result: Literal["correct", "incorrect"]
    created_at: datetime


class CardBase(BaseModel):
    subject_id: int
    front_md: str = ""
    back_md: str = ""


class CardCreate(CardBase):
    tag_names: list[str] = Field(default_factory=list)


class CardUpdate(BaseModel):
    subject_id: int | None = None
    front_md: str | None = None
    back_md: str | None = None
    tag_names: list[str] | None = None


class CardSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subject_id: int
    subject_name: str
    front_md: str
    back_md: str
    tags: list[str]
    updated_at: datetime


class CardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subject_id: int
    subject_name: str
    front_md: str
    back_md: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    last10_attempts: list[AttemptOut]


class ImageOut(BaseModel):
    id: str
    ext: str
    filename: str  # "<id>.<ext>"


class AttemptCreate(BaseModel):
    card_id: int
    result: Literal["correct", "incorrect"]


class PracticeNextQuery(BaseModel):
    mode: Literal["random", "inorder", "smart"] = "random"
    subject_id: int | None = None
    tag_ids: list[int] = Field(default_factory=list)
    cursor_id: int | None = None  # for inorder mode


MasteryName = Literal["memorized", "familiar", "learning", "new"]


class MasteryCounts(BaseModel):
    memorized: int = 0
    familiar: int = 0
    learning: int = 0
    new: int = 0


class HomeTotals(MasteryCounts):
    subjects: int = 0
    cards: int = 0


class SubjectMastery(MasteryCounts):
    id: int
    name: str
    card_count: int


class ReviewCard(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    front_md: str
    tags: list[str]
    weight: float
    mastery: MasteryName


class HomeStats(BaseModel):
    totals: HomeTotals
    subjects: list[SubjectMastery]
    needs_review: list[ReviewCard]
