from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .storage import db_path


class Base(DeclarativeBase):
    pass


_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def engine():
    global _engine, _SessionLocal
    if _engine is None:
        url = f"sqlite:///{db_path()}"
        _engine = create_engine(url, future=True, connect_args={"check_same_thread": False})

        @event.listens_for(_engine, "connect")
        def _enable_fk(dbapi_conn, _record):
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

        _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)
    return _engine


def init_db() -> None:
    from . import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine())


def get_session() -> Iterator[Session]:
    if _SessionLocal is None:
        engine()
    assert _SessionLocal is not None
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()
