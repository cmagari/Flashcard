"""Shared test fixtures.

Each test gets a `client` that talks to the real FastAPI app, but with the
SQLite database isolated to a per-test tmp_path. We achieve isolation by:
  1. Pointing FLASHCARD_DATA_DIR at tmp_path before the app loads, so
     storage.app_data_dir() resolves to a fresh directory.
  2. Resetting db._engine / db._SessionLocal to None so init_db() builds a
     new engine bound to the per-test path (the module caches them as
     globals).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FLASHCARD_DATA_DIR", str(tmp_path))

    from app import db

    monkeypatch.setattr(db, "_engine", None)
    monkeypatch.setattr(db, "_SessionLocal", None)

    from app.main import app

    with TestClient(app) as c:
        yield c
