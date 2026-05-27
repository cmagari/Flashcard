from __future__ import annotations

import os
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..storage import backups_dir, db_path

router = APIRouter(prefix="/api/backup", tags=["backup"])

MAX_BACKUPS = 3
BACKUP_PREFIX = "flashcards-"
BACKUP_SUFFIX = ".db"
TIMESTAMP_FMT = "%Y%m%d-%H%M%S"


class BackupOut(BaseModel):
    filename: str
    size_bytes: int
    created_at: datetime


def _list_backup_paths() -> list[Path]:
    d = backups_dir()
    files = [
        p
        for p in d.iterdir()
        if p.is_file()
        and p.name.startswith(BACKUP_PREFIX)
        and p.name.endswith(BACKUP_SUFFIX)
    ]
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return files


def _serialize(p: Path) -> BackupOut:
    st = p.stat()
    return BackupOut(
        filename=p.name,
        size_bytes=st.st_size,
        created_at=datetime.fromtimestamp(st.st_mtime, tz=timezone.utc),
    )


@router.get("", response_model=list[BackupOut])
def list_backups() -> list[BackupOut]:
    return [_serialize(p) for p in _list_backup_paths()]


@router.post("", response_model=BackupOut, status_code=status.HTTP_201_CREATED)
def create_backup() -> BackupOut:
    src = db_path()
    if not src.exists():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Database file does not exist yet"
        )

    d = backups_dir()
    ts = datetime.now(timezone.utc).strftime(TIMESTAMP_FMT)
    final = d / f"{BACKUP_PREFIX}{ts}{BACKUP_SUFFIX}"

    # Write into a hidden temp file in the same dir and atomic-rename on
    # success, so a crash mid-copy can't leave behind a half-written file
    # that looks like a legitimate backup.
    fd, tmp_path_str = tempfile.mkstemp(
        prefix=".backup-", suffix=BACKUP_SUFFIX, dir=str(d)
    )
    os.close(fd)
    tmp_path = Path(tmp_path_str)
    try:
        src_conn = sqlite3.connect(str(src))
        try:
            dest_conn = sqlite3.connect(str(tmp_path))
            try:
                src_conn.backup(dest_conn)
            finally:
                dest_conn.close()
        finally:
            src_conn.close()
        os.replace(tmp_path, final)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise

    # Prune oldest beyond MAX_BACKUPS — done after the new write succeeds,
    # so a failed backup never leaves us short.
    for old in _list_backup_paths()[MAX_BACKUPS:]:
        try:
            old.unlink()
        except OSError:
            pass

    return _serialize(final)
