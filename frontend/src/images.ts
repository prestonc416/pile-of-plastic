/**
 * Item photos are static files in frontend/public/items/, written by
 * backend/prepare_images.py. The API stores their paths relative to
 * public/, so moving them to a CDN later only changes this prefix.
 */
const BASE = import.meta.env.BASE_URL // "/" unless Vite's `base` option is set

/** URL for a path from the API, e.g. "items/gambit/1.webp" gives "/items/gambit/1.webp". */
export function imageUrl(path: string): string {
  return `${BASE}${path}`
}
