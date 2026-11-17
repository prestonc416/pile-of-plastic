/**
 * Shapes of the JSON the FastAPI backend sends and accepts.
 * Kept in sync by hand with backend/app/schemas/*.py.
 *
 * Money fields are Decimal on the server, which serializes as a string
 * (e.g. "24.99"). They stay strings here: converting to a JS number would
 * reintroduce floating-point rounding. See format.ts for safe arithmetic.
 */

/**
 * One photo of a catalog item (schemas/item.py ItemImageRead).
 * Paths are relative to frontend/public, e.g. "items/gambit/1.webp".
 * Use imageUrl() in images.ts to turn one into a URL.
 */
export interface ItemImage {
  /** 1-based display order; position 1 is the main photo. */
  position: number
  /** Full-size photo, up to 1200px on the long edge. */
  path: string
  /** 200px square crop for lists. */
  thumb_path: string
  alt_text: string
}

/** Catalog item: GET /items/ and GET /items/{slug} (schemas/item.py ItemRead). */
export interface Item {
  id: number
  slug: string
  figure: string
  line: string | null
  brand: string | null
  current_price: string | null
  description: string | null
  /** Already in display order. Empty when the item has no photos. */
  images: ItemImage[]
}

/** The owner's own photo of one copy (schemas/collection.py EntryPhotoRead). */
export interface EntryPhoto {
  id: number
  /** Full-size photo, up to 1600px on the long edge. Absolute URL. */
  url: string
  /** 200px square crop for lists. Absolute URL. */
  thumb_url: string
}

/** One owned copy of an item (schemas/collection.py CollectionEntryRead). */
export interface CollectionEntry {
  id: number
  item: Item
  bought_for: string | null
  /** ISO 8601 timestamp, or null if the user did not record a date. */
  acquired_at: string | null
  notes: string | null
  created_at: string
  /** Oldest first. At most MAX_PHOTOS_PER_ENTRY (photos.ts). */
  photos: EntryPhoto[]
}

/** The per-entry fields a user can edit. null clears the field on the server. */
export interface EntryFields {
  bought_for: string | null
  acquired_at: string | null
  notes: string | null
}

/** Body for POST /collection/ (schemas/collection.py CollectionEntryCreate). */
export interface NewEntry extends Partial<EntryFields> {
  item_id: number
}

/** Body for POST /auth/login and POST /auth/register. */
export interface Credentials {
  email: string
  password: string
}

/** Response from POST /auth/login (schemas/auth.py Token). */
export interface Token {
  access_token: string
  token_type: string
}

/** Response from GET /auth/me and POST /auth/register (schemas/user.py UserOut). */
export interface User {
  id: number
  email: string
  created_at: string
}
