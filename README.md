# pile-of-plastic

A full-stack web app for tracking an action figure collection. Browse a
catalog of figures, log the copies you own with what you paid and when you
got them, and attach your own photos of each copy.

## Features

- **Catalog:** search and filter figures by brand, grouped by line, with
  photos and descriptions.
- **Accounts:** register and log in with email and password.
- **Your collection:** add figures with price paid, date, notes, and up to two
  photos per copy. See the total you've spent.
- **Copy page:** a photo viewer for your photos and the catalog's, plus
  editing and removal.
- **Private by owner:** every collection route only ever returns the logged-in
  user's own data.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query |
| Backend | FastAPI, SQLAlchemy 2.0 (sync), Pydantic v2, Alembic |
| Database | PostgreSQL (hosted on Neon) |
| Auth | JWT bearer tokens (PyJWT), Argon2id password hashing (pwdlib) |
| Images | Pillow: resize, re-encode to WebP, strip metadata |

## Repository layout

```
backend/
  app/
    api/routes/   auth, items (catalog), collection (+ photos)
    core/         settings, password hashing, JWT
    db/           engine, session, models
    schemas/      request and response shapes
    services/     users, photo processing, file storage
  alembic/        database migrations
  items.csv       the catalog (source of truth)
  item_images.csv catalog photo list
frontend/         React app (see frontend/README.md)
```

## Run it locally

You need Python 3.13 or newer, Node.js 20.19+ or 22.12+ (required by Vite),
and a PostgreSQL database (a free Neon database works). Developed on Windows
with Python 3.14.

### 1. Backend (port 8000)

From `backend/`:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1        # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env             # macOS/Linux: cp .env.example .env
```

Edit `.env`: set `DATABASE_URL`, and set `JWT_SECRET_KEY` to the output of
`python -c "import secrets; print(secrets.token_urlsafe(64))"`. The app
refuses to start with a placeholder or short secret.

Then create the tables, load the catalog, and start the API:

```powershell
alembic upgrade head
python import_items.py
python import_images.py
uvicorn app.main:app --reload
```

Interactive API docs are at http://localhost:8000/docs.

On Windows, if activating the venv is blocked, first run
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned`.

### 2. Frontend (port 5173)

In a second terminal, from `frontend/`:

```powershell
npm install
npm run dev
```

Open http://localhost:5173 (use `localhost`, not `127.0.0.1`, to match the
allowed CORS origin).

## Configuration

Settings are read from environment variables or `backend/.env`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | | `postgresql+psycopg2://user:pass@host/db` |
| `JWT_SECRET_KEY` | Yes | | Signs access tokens; 32+ characters |
| `JWT_ALGORITHM` | No | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated frontend origins |
| `MEDIA_BASE_URL` | No | `http://localhost:8000/uploads` | Public URL prefix for uploaded photos |
| `UPLOAD_DIR` | No | `backend/uploads` | Where uploaded photos are stored |
| `DEBUG` | No | `false` | |

The frontend reads `VITE_API_URL` (default `http://localhost:8000`).

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | | Create an account |
| POST | `/auth/login` | | Get an access token |
| GET | `/auth/me` | Yes | The current user |
| GET | `/items/` | | The whole catalog |
| GET | `/items/{slug}` | | One catalog item |
| GET | `/collection/` | Yes | Your copies, newest first |
| POST | `/collection/` | Yes | Add a copy |
| GET | `/collection/{id}` | Yes | One of your copies |
| PATCH | `/collection/{id}` | Yes | Edit price, date, or notes |
| DELETE | `/collection/{id}` | Yes | Remove a copy and its photos |
| POST | `/collection/{id}/photos` | Yes | Upload a photo (JPG, PNG, WebP; 10 MB; max 2) |
| DELETE | `/collection/{id}/photos/{photo_id}` | Yes | Remove a photo |

Another user's copy or photo returns 404, so the API never reveals which ids
exist.

## Managing the catalog

The catalog is changed only through CSV files, not the API.

- **Figures:** edit `backend/items.csv` (columns `slug`, `Figure`, `Line`,
  `Brand`, `Available at:`, and optional `Description`), then run
  `python import_items.py`. Rows are matched by `slug`, so re-running updates
  in place.
- **Photos:** see "Photos" in [frontend/README.md](frontend/README.md).

## Tests

From `backend/` with the venv active. Both use a throwaway in-memory SQLite
database and never touch your real database (they still need `backend/.env`
so settings load).

```powershell
python test_auth_routes.py     # register, login, /auth/me
python test_entry_photos.py    # photo upload, limits, ownership, cleanup
```

The frontend is checked with `npm run build` (type-check) and `npm run lint`.

## Design decisions

- **Sync SQLAlchemy** over async, for simpler code while learning.
- **Neon** over Supabase: a free Postgres tier with no card required, and the
  app has its own auth.
- **Catalog keyed by slug:** action figures have no universal ID like an
  ISBN, so each figure gets a readable unique slug.
- **Access token in memory only** (not localStorage), so injected scripts
  can't steal a stored copy. Refreshing the page logs you out.
- **Money as decimals:** stored as `Numeric(10, 2)`, sent as strings, summed in
  integer cents in the browser.
- **Uploads re-encoded:** every user photo is decoded and saved as WebP, which
  proves it's an image and removes GPS data.

## Known limitations and next steps

- **Deployment:** planned on Vercel (frontend) and Render (backend). Uploaded
  photos must move to object storage first (e.g. Cloudflare R2), because
  Render's free tier deletes local files on restart. Only
  `backend/app/services/storage.py` needs a new class.
- **Staying logged in:** a refresh-token cookie would keep users logged in
  across page reloads.
- **Admin catalog editing** through the API, instead of CSV only.
- **Dates:** `acquired_at` is a timestamp; a plain date column would be simpler.
