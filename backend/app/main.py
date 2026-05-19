from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import cards, images, practice, stats, subjects, tags
from .storage import app_data_dir, db_path, images_dir

logger = logging.getLogger("flashcard")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database initialized")
    yield


app = FastAPI(title="Flashcard Backend", lifespan=lifespan)

allowed = os.environ.get(
    "FLASHCARD_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/info")
def info() -> dict[str, str]:
    return {
        "data_dir": str(app_data_dir()),
        "db_path": str(db_path()),
        "images_dir": str(images_dir()),
    }


app.include_router(subjects.router)
app.include_router(cards.router)
app.include_router(tags.router)
app.include_router(images.router)
app.include_router(practice.router)
app.include_router(stats.router)
