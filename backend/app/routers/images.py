from __future__ import annotations

import io
import re
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image as PILImage
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import Card, Image
from ..schemas import ImageOut
from ..storage import images_dir

router = APIRouter(prefix="/api/images", tags=["images"])

ALLOWED_FORMATS = {"PNG": "png", "JPEG": "jpg", "GIF": "gif", "WEBP": "webp"}
MAX_BYTES = 25 * 1024 * 1024  # 25 MB


class ImageFromUrl(BaseModel):
    url: HttpUrl


def _save_image_bytes(raw: bytes, session: Session) -> ImageOut:
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Empty image")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
    try:
        with PILImage.open(io.BytesIO(raw)) as im:
            im.verify()
        with PILImage.open(io.BytesIO(raw)) as im:
            fmt = (im.format or "").upper()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Could not parse image"
        ) from exc
    if fmt not in ALLOWED_FORMATS:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image format: {fmt}",
        )
    ext = ALLOWED_FORMATS[fmt]
    image_id = str(uuid.uuid4())
    path = images_dir() / f"{image_id}.{ext}"
    path.write_bytes(raw)
    record = Image(id=image_id, ext=ext)
    session.add(record)
    session.commit()
    return ImageOut(id=image_id, ext=ext, filename=f"{image_id}.{ext}")


@router.post("", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...), session: Session = Depends(get_session)
) -> ImageOut:
    raw = await file.read()
    return _save_image_bytes(raw, session)


@router.post("/from-url", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
def upload_image_from_url(
    payload: ImageFromUrl, session: Session = Depends(get_session)
) -> ImageOut:
    url = str(payload.url)
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid URL scheme")
    req = urllib.request.Request(
        url, headers={"User-Agent": "Flashcard/0.1 (+local)"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read(MAX_BYTES + 1)
    except urllib.error.URLError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, detail=f"Could not fetch URL: {exc.reason}"
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, detail=f"Could not fetch URL: {exc}"
        ) from exc
    if len(raw) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
    return _save_image_bytes(raw, session)


# pattern for app-image:// references inside card markdown
_APP_IMAGE_REF = re.compile(r"app-image://([A-Za-z0-9._-]+)")


def _referenced_filenames(session: Session) -> set[str]:
    refs: set[str] = set()
    for card in session.execute(select(Card)).scalars():
        for content in (card.front_md or "", card.back_md or ""):
            for m in _APP_IMAGE_REF.finditer(content):
                refs.add(m.group(1))
    return refs


@router.get("/orphans")
def list_orphans(session: Session = Depends(get_session)) -> dict:
    referenced = _referenced_filenames(session)
    on_disk = {f.name for f in images_dir().iterdir() if f.is_file()}
    db_files = {
        f"{img.id}.{img.ext}" for img in session.execute(select(Image)).scalars()
    }
    orphans = sorted((on_disk | db_files) - referenced)
    return {"count": len(orphans), "filenames": orphans}


@router.post("/cleanup")
def cleanup_orphans(session: Session = Depends(get_session)) -> dict:
    referenced = _referenced_filenames(session)
    deleted: list[str] = []

    for f in images_dir().iterdir():
        if not f.is_file() or f.name in referenced:
            continue
        try:
            f.unlink()
            deleted.append(f.name)
        except OSError:
            pass

    for img in session.execute(select(Image)).scalars().all():
        filename = f"{img.id}.{img.ext}"
        if filename not in referenced:
            session.delete(img)
            if filename not in deleted:
                deleted.append(filename)
    session.commit()

    return {"deleted": len(deleted), "filenames": deleted}


@router.get("/{filename}")
def get_image(filename: str) -> FileResponse:
    safe = Path(filename).name  # strip any path traversal
    path = images_dir() / safe
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return FileResponse(path)
