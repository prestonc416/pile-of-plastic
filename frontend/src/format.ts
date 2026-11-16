/**
 * Money and date helpers.
 *
 * Money: the API sends prices as decimal strings ("24.99"). All arithmetic
 * here is done in whole cents (integers), never floating-point dollars, so
 * totals cannot drift by a cent.
 *
 * Dates: the API stores `acquired_at` as a timestamp, but the UI only asks
 * for a calendar day. A day is sent as noon UTC and always read back in UTC,
 * so it shows as the same calendar day no matter where the browser is.
 */

/** Up to 8 whole digits and 2 decimals: the range of Numeric(10, 2). */
const MONEY_PATTERN = /^(\d{1,8})(?:\.(\d{1,2}))?$/

/**
 * Parse a decimal money string into whole cents.
 * @returns cents (e.g. "24.9" gives 2490), or null if the text is not a valid
 *          non-negative amount with at most 2 decimals.
 */
export function toCents(value: string): number | null {
  const match = MONEY_PATTERN.exec(value.trim())
  if (match === null) return null
  const [, whole, fraction = ''] = match
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** Format whole cents for display, e.g. 2499 gives "$24.99". */
export function formatCents(cents: number): string {
  // Dividing here is display-only; the formatter rounds to 2 decimals.
  return usd.format(cents / 100)
}

/** Format an API money string for display. Returns null if it cannot be parsed. */
export function formatMoney(value: string): string | null {
  const cents = toCents(value)
  return cents === null ? null : formatCents(cents)
}

const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

/** Format an API timestamp as a calendar day, e.g. "Nov 16, 2026". */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso))
}

/** Convert an API timestamp to the "YYYY-MM-DD" value a date input expects. */
export function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/** Convert a date input's "YYYY-MM-DD" value to the timestamp the API stores. */
export function fromDateInput(day: string): string {
  return `${day}T12:00:00Z`
}

/** Today's date as "YYYY-MM-DD" in the user's own timezone. */
export function todayDateInput(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
