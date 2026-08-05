# Flashcard

A local-only desktop flashcard app: Electron + React (Vite + Tailwind) frontend, Python FastAPI backend, SQLite storage. Markdown and LaTeX (KaTeX) rendering, image paste/drop, three practice modes (random, in-order, smart).

## Download (Windows)

Pre-built installers are attached to each [release](https://github.com/cmagari/Flashcard/releases) — grab the latest `Flashcard Setup x.y.z.exe` and run it.

The installer is **unsigned** (no code-signing certificate), so Windows SmartScreen will show *"Windows protected your PC"* the first time you run it. To proceed:

1. Click **More info**
2. Click **Run anyway**

The build is reproducible: every release is built in GitHub Actions on `windows-latest` from a tagged commit (`.github/workflows/release.yml`).

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
- Vite dev server on `http://localhost:5183`
- Electron, which spawns the FastAPI backend on a free port (with `--reload`) and loads the Vite URL

The Electron main process picks an unused port for FastAPI, waits for `/health`, then opens the renderer. Backend port is exposed to the renderer via `preload.js → window.flashcardApi.baseUrl`.

If port 5183 is already in use, change `frontend/vite.config.ts` (`server.port`) and the matching value in `electron/main.js` and `package.json`.

## Run backend tests

```bash
npm run test:backend
```

## Build a packaged Windows installer

The packaged app ships a self-contained Python interpreter (via PyInstaller) and the built React bundle, so end users don't need Node, Python, or `uv`. Output lands in `release/Flashcard Setup 0.1.0.exe` (NSIS installer).

```bash
npm run build
```

This runs four steps in order:

| Step | Script | What it does |
| --- | --- | --- |
| 1 | `npm run test:backend` | pytest — aborts the build if any test fails |
| 2 | `npm run build:frontend` | `tsc -b` (type-check) + Vite → `frontend/dist/` |
| 3 | `npm run build:backend`  | PyInstaller → `backend/dist/flashcard-backend/flashcard-backend.exe` (with `_internal/` deps folder) |
| 4 | `npm run build:installer` | electron-builder → `release/Flashcard Setup 0.1.0.exe` |

You can run any step on its own — useful when iterating on just the backend or frontend.

### One-time Windows setup for `build:installer`

electron-builder unpacks a `winCodeSign` archive that contains macOS `.dylib` symlinks. Creating those symlinks on Windows requires elevated privileges, even though we never use the macOS pieces. Pick one fix (do it once per machine):

1. **Enable Developer Mode** *(recommended — persistent, no admin terminal needed)*
   - Windows 11: `Settings → Privacy & Security → For developers → Developer Mode = On`
   - Windows 10: `Settings → Update & Security → For developers → Developer Mode = On`
2. **Run the build from an Administrator PowerShell** — open PowerShell **as Administrator**, then `cd` to the repo and `npm run build`.

After either, `npm run build` runs cleanly.

### What the build emits

```
backend/dist/flashcard-backend/    # PyInstaller output (input to step 3)
frontend/dist/                     # Vite output (input to step 3)
release/
  win-unpacked/                    # exploded app dir
  Flashcard Setup 0.1.0.exe        # NSIS installer to ship
```

The installer prompts for an install location, installs the app per-user, and creates a Start menu + desktop shortcut named "Flashcard". On launch the app spawns the bundled `flashcard-backend.exe` from `resources/backend/`, waits for `/health`, then loads `resources/frontend/index.html`.

### Cutting a release

GitHub Actions builds a Windows installer and publishes it as a Release whenever a `v*` tag is pushed.

1. Bump `version` in both `package.json` and `electron/package.json` so the artifact filename matches the tag (electron-builder names the `.exe` from `electron/package.json`).
2. Commit the bump.
3. Tag + push:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
4. The [`Release` workflow](.github/workflows/release.yml) runs `npm run install:all && npm run build` on `windows-latest` (which includes `npm run test:backend` as the first step) and creates a Release with the installer attached.

## Storage

App data lives at `%APPDATA%\Flashcard\Flashcard\` on Windows (or the `platformdirs` equivalent on macOS / Linux):

- `flashcards.db` — SQLite database
- `images/<uuid>.<ext>` — image blobs

Override via `FLASHCARD_DATA_DIR` env var (used by the test suite). The Settings page in the app shows these paths and has buttons to open them in the OS file manager.

You can also pick a custom data folder from the Settings page ("Data folder → Choose folder…"). The choice is persisted in Electron's `userData/config.json` and is passed to the backend as `FLASHCARD_DATA_DIR` on every launch. "Reset to default" clears the override. Switching folders restarts the backend.

## Drafts

Any card can be marked **Draft** from the checkbox in the card editor (both the
full page and the edit modal). A draft stays in your library and stays editable,
but is held back from everything practice-related:

- **Practice** never serves it, in any mode.
- **Home stats** ignore it — totals, per-subject mastery bars, and the "needs
  review" queue. An unattempted card scores the highest review weight, so
  counting drafts would park them permanently at the top of a queue they can
  never leave.
- **Subjects** card counts still include drafts — that page is a library view.

Home shows an amber **Drafts** tile with the outstanding count, linking to
`/cards?draft=drafts`. The tile only appears when there is at least one draft.

The Cards page has an **All cards / Drafts only / Finished only** filter — held
in the URL (`?draft=drafts`) so it can be linked to — and draft cards carry an
amber `Draft` badge in both the Cards and Subject views. The API exposes this as
`is_draft` on a card, `drafts` in `GET /api/stats/home` totals, and
`GET /api/cards?draft=true|false`.

## Practice modes

- **Random** — uniform random pick from the filtered pool.
- **In order** — iterates by `created_at` ascending; client tracks the cursor.
- **Smart** — weighted random where weight = `1 + min(days_since_seen / 7, 5) + 3 * (1 - correct_ratio_last_10) + (2 if never seen else 0)`. Tunable in `backend/app/smart.py`.

Skips are not logged. Each card keeps only its 10 most recent attempts.

## In-app help

The **?** button at the right of the header opens a modal covering the whole app
broadly — the subject/card/practice loop, Markdown and LaTeX, images, tags,
drafts, the three practice modes, and what Home's bars mean. Source:
`frontend/src/components/HelpModal.tsx`.

## Keyboard shortcuts

The full list is shown in-app under **Settings → Keyboard shortcuts**.

Practice page:

- `Space` / `Enter` — flip card
- `1` — Correct
- `2` — Incorrect
- `3` — Skip

Card editor:

- `Ctrl+B` / `Ctrl+I` / `Ctrl+U` — bold / italic / underline
- `Enter` — continue the current markdown list (`-`, `*`, `+`, `1.`, `1)`, and
  `- [ ]` task items); on an item with no content it strips the marker and
  drops you out of the list. The marker must open the line, so `5 - 3` and
  `version 1.5` mid-sentence are left alone, as is a `-` opening a line inside
  a `$$…$$` block. `Shift+Enter` always inserts a plain newline.
- `$`, `{`, `[`, `(` — wrap the selection; auto-close inside math
- `\frac`, `\sqrt`, … — auto-insert `{}` argument braces inside math

## Spell check

Right-clicking in any text field opens a context menu with spelling suggestions
("Add to dictionary" included) plus cut/copy/paste — the app has no menu bar, so
this is the only place those live.

Chromium is supposed to fetch its Hunspell dictionary from Google's CDN on first
use, but on some machines that download is never even attempted, leaving
`<userData>/Dictionaries` empty forever — nothing gets flagged and the menu has
no corrections to offer. It *will* load a dictionary that is already on disk, so
`electron/dictionaries/en-us-10-1.bdic` ships with the app and is copied into
place at startup (`setUpSpellChecker` in `electron/main.js`).

The filename must match what Chromium looks for: `<lang>-<feature version>.bdic`.
If an Electron upgrade bumps that version, spellcheck goes quiet — refresh the
bundled file from `https://redirector.gvt1.com/edgedl/chrome/dict/` and update
the two constants in `main.js`. The startup log reports what happened:

```
[spellcheck] enabled=true languages=en-US dictionary=present
```

## Settings page

- View the resolved data folder, database, and images folder paths
- Open them in the OS file manager (uses Electron's `shell.openPath`)
- **Image cleanup** — images are written to disk as soon as you paste/drop them in the editor. If you don't end up saving the card, those files are left behind. The Settings page scans every card's markdown for `app-image://...` references and deletes any unreferenced files + DB rows.

## Project layout

```
backend/   FastAPI + SQLAlchemy + Pillow + platformdirs
  app/         routers, models, smart-mode algorithm
  launch.py    entrypoint used by PyInstaller
  tests/       pytest unit tests for smart algorithm
frontend/  React + Vite + Tailwind + react-markdown + KaTeX
  src/pages/   Cards, Subjects, SubjectDetail, CardEdit, Practice, Settings
  src/components/  CardEditor, MarkdownView, CardPreview, Dialog, TagPicker
electron/  Electron main + preload (sidecar lifecycle)
  main.js      backend spawn (dev: uv run / prod: bundled exe), context menu, spellcheck
  preload.js   exposes baseUrl + openPath via contextBridge
  dictionaries/  bundled Hunspell dictionary (see "Spell check")
  icon.svg / icon.png / icon.ico   app icon (F in a blue rounded square)
```

## Tech notes

- **Markdown × LaTeX**: `MarkdownView` runs a small preprocessor that auto-normalizes `$$...$$` blocks containing newlines onto their own lines, working around `remark-math` treating same-line content after `$$` as a fence info string and dropping it.
- **Image scheme**: editor inserts `![](app-image://<uuid>.<ext>)`. `MarkdownView` whitelists this scheme past react-markdown's URL sanitizer, then rewrites it to `http://127.0.0.1:<port>/api/images/<filename>` at render time.
- **Drag from web**: backend `POST /api/images/from-url` fetches the image server-side (bypasses renderer CORS) and stores it locally.
- **Smart-mode**: see `backend/app/smart.py`. Five pytest unit tests cover never-seen, recent+correct, old+bad, distribution, and weighted-pick behavior.
