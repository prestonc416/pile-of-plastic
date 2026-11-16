import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { fromDateInput, toCents, toDateInput, todayDateInput } from '../format.ts'
import type { EntryFields } from '../types.ts'

/** Matches max_length=2000 on `notes` in the backend schema. */
const NOTES_MAX_LENGTH = 2000

interface EntryFormProps {
  /** Existing values when editing; omit for a blank form. */
  initial?: EntryFields
  submitLabel: string
  pendingLabel: string
  isPending: boolean
  /** Error from the last save attempt, if any. */
  error: string | null
  onSubmit: (fields: EntryFields) => void
  /** Shows a Cancel button when provided. */
  onCancel?: () => void
}

/**
 * Price, date, and notes for one owned figure. All three are optional.
 * Empty inputs are submitted as null, which clears the field on the server.
 */
export default function EntryForm({
  initial,
  submitLabel,
  pendingLabel,
  isPending,
  error,
  onSubmit,
  onCancel,
}: EntryFormProps) {
  const id = useId()
  const [price, setPrice] = useState(initial?.bought_for ?? '')
  const [day, setDay] = useState(initial?.acquired_at ? toDateInput(initial.acquired_at) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [priceError, setPriceError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPrice = price.trim()
    if (trimmedPrice !== '' && toCents(trimmedPrice) === null) {
      setPriceError('Enter an amount like 24.99, with no more than 2 decimals.')
      return
    }
    setPriceError(null)
    const trimmedNotes = notes.trim()
    onSubmit({
      bought_for: trimmedPrice === '' ? null : trimmedPrice,
      acquired_at: day === '' ? null : fromDateInput(day),
      notes: trimmedNotes === '' ? null : trimmedNotes,
    })
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit} noValidate>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-price`}>Price paid (USD)</label>
          <input
            id={`${id}-price`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="24.99"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            aria-invalid={priceError !== null}
            aria-describedby={priceError !== null ? `${id}-price-error` : undefined}
          />
          {priceError !== null && (
            <p className="field-error" id={`${id}-price-error`}>
              {priceError}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${id}-day`}>Date you got it</label>
          <input
            id={`${id}-day`}
            type="date"
            max={todayDateInput()}
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-notes`}>Notes</label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          maxLength={NOTES_MAX_LENGTH}
          placeholder="Condition, where you found it, missing accessories"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      {error !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="button" onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
