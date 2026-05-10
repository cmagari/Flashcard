# Flashcard

A local-only desktop flashcard app: Electron + React (Vite + Tailwind) frontend, Python FastAPI backend, SQLite storage. Markdown and LaTeX (KaTeX) rendering, image paste/drop, three practice modes (random, in-order, smart).

## Prerequisites

- Node.js 18+
- Python 3.10+
- [uv](https://docs.astral.sh/uv/) for Python package management

## Setup

```bash
npm run install:all
```

This installs `frontend/`, `electron/`, and runs `uv sync` for `backend/`.

## Run (dev)

```bash
npm run dev
```

This launches:
- Vite dev server on `http://localhost:5173`
- Electron, which spawns the FastAPI backend on a free port and loads the Vite URL

The Electron main process picks an unused port for FastAPI, waits for `/health`, then opens the renderer. Backend port is exposed to the renderer via `preload.js → window.flashcardApi.baseUrl`.

If port 5173 is already in use, change `frontend/vite.config.ts` (`server.port`).

## Run backend tests

```bash
npm run test:backend
```

## Storage

App data lives at `%APPDATA%\Flashcard\Flashcard\` on Windows (or `platformdirs` equivalent elsewhere):

- `flashcards.db` — SQLite database
- `images/<uuid>.<ext>` — image blobs

Override via `FLASHCARD_DATA_DIR` env var (used by the test suite).

## Practice modes

- **Random** — uniform random pick from the filtered pool.
- **In order** — iterates by `created_at` ascending; client tracks the cursor.
- **Smart** — weighted random where weight = `1 + min(days_since_seen / 7, 5) + 3 * (1 - correct_ratio_last_10) + (2 if never seen else 0)`. Tunable in `backend/app/smart.py`.

Skips are not logged. Each card keeps only its 10 most recent attempts.

## Keyboard shortcuts (Practice page)

- `Space` / `Enter` — flip card
- `1` — Correct
- `2` — Incorrect
- `3` — Skip

## Project layout

```
backend/   FastAPI + SQLAlchemy + Pillow + platformdirs
frontend/  React + Vite + Tailwind + react-markdown + KaTeX
electron/  Electron main + preload (sidecar lifecycle)
```
