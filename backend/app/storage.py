from __future__ import annotations

import os
from pathlib import Path

from platformdirs import user_data_dir

APP_NAME = "Flashcard"
APP_AUTHOR = "Flashcard"


def app_data_dir() -> Path:
    override = os.environ.get("FLASHCARD_DATA_DIR")
    base = Path(override) if override else Path(user_data_dir(APP_NAME, APP_AUTHOR))
    base.mkdir(parents=True, exist_ok=True)
    return base


def images_dir() -> Path:
    d = app_data_dir() / "images"
    d.mkdir(parents=True, exist_ok=True)
    return d


def db_path() -> Path:
    return app_data_dir() / "flashcards.db"


def backups_dir() -> Path:
    d = app_data_dir() / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d
