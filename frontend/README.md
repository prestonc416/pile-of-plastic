# pile-of-plastic frontend

React + TypeScript single-page app (Vite) for the Collection Tracker API in `../backend`.

## Run it

1. Start the API from `backend/`: `uvicorn app.main:app --reload` (port 8000).
2. From `frontend/`:
   ```
   npm install
   npm run dev
   ```
3. Open http://localhost:5173.

The API URL defaults to `http://localhost:8000`. To change it, create
`frontend/.env.local` with `VITE_API_URL=https://your-api.example.com`.
The API must list this app's origin in `CORS_ORIGINS`.

## Scripts

- `npm run dev`: dev server with hot reload
- `npm run build`: type-check, then build to `dist/`
- `npm run lint`: ESLint
- `npm run preview`: serve the production build locally

## Pages

| Route | What it does | Login needed |
|---|---|---|
| `/` | Catalog: search, filter by brand, one-click add | No (adding needs login) |
| `/items/:slug` | One figure, add a copy with price, date, notes | No (adding needs login) |
| `/collection` | Your copies: total spent, edit, remove | Yes |
| `/collection/:entryId` | One copy, read-only: photo viewer, description, your notes | Yes |
| `/login`, `/register` | Log in or create an account | No |

## Layout

```
src/
  main.tsx        providers (TanStack Query, router), logout cache clearing
  App.tsx         route table
  api.ts          typed fetch client, one function per endpoint
  authStore.ts    in-memory access token
  queries.ts      TanStack Query definitions and mutations
  format.ts       money (integer cents) and date helpers
  types.ts        API response and request shapes
  components/     Layout, RequireAuth, EntryForm
  pages/          one file per route
  index.css       all styles and design tokens
```

## Photos

Item photos are your own pictures, served as static files from
`public/items/<slug>/`. From `backend/`, with the venv active:

1. Put originals in `backend/photos/<slug>/` (JPG, PNG, or WebP; name them
   `1.jpg`, `2.jpg` to set the order). This folder is gitignored.
2. `python prepare_images.py`: writes resized WebP files with metadata
   (including GPS location) removed, and lists them in `item_images.csv`.
3. Edit the `alt_text` column in `item_images.csv` to describe each photo.
4. `python import_images.py`: loads `item_images.csv` into the database.
5. Commit `frontend/public/items/` and `backend/item_images.csv`.

Descriptions come from an optional `Description` column in `items.csv`,
loaded by `python import_items.py`.

### Users' own photos

Logged-in users can attach up to 2 photos to each copy in their collection,
when adding it or later from the collection page. The API checks each file
(JPG, PNG, or WebP, up to 10 MB), re-encodes it to WebP with metadata
removed, and stores it under `backend/uploads/` (gitignored), served at
`/uploads/`. File names are random, so links can't be guessed, but anyone
given an exact link can open it.

Before deploying, move uploads to object storage: free hosts such as
Render's free tier delete local files on every redeploy or restart. Only
`backend/app/services/storage.py` needs a new storage class.

## Decisions

- **Token storage:** the access token is kept in memory only, never in
  localStorage or a cookie. Refreshing the page logs you out. A refresh-token
  cookie would fix that and needs backend work.
- **Money:** prices arrive as decimal strings and are summed in integer cents.
- **Dates:** the API stores a timestamp; the UI sends a chosen day as noon UTC
  and reads it back in UTC, so the day never shifts with timezone.
- **Currency:** displayed as USD.
