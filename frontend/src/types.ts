/** Catalog item as returned by GET /items/ and GET /items/{slug}. */
export interface Item {
  id: number
  slug: string
  figure: string
  line: string
  brand: string
  /** Decimal serialized as a string (e.g. "24.99"), or null if unknown. */
  current_price: string | null
}