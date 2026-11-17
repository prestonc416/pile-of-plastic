import { useEffect, useId, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'

export interface CardMenuItem {
  label: string
  onSelect: () => void
  /** Styles the item as destructive (red). */
  danger?: boolean
}

/**
 * A "more actions" button (three dots) that opens a short list of actions.
 *
 * Built as a disclosure (a button that shows and hides a list of buttons),
 * which is the simplest accessible pattern for a few actions: Tab and
 * Shift+Tab move between them, Escape closes and returns focus to the dots,
 * and clicking anywhere outside closes it.
 */
export default function CardMenu({ label, items }: { label: string; items: CardMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    firstItemRef.current?.focus()
    // Close on a click or tap anywhere outside this menu. The listener only
    // exists while the menu is open, and the cleanup always removes it.
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
  }

  /** Close when keyboard focus moves outside the menu (e.g. Tab past the last item). */
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false)
  }

  return (
    <div className="card-menu" ref={rootRef} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        className="card-menu-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open && (
        <ul className="card-menu-list" id={menuId}>
          {items.map((item, index) => (
            <li key={item.label}>
              <button
                ref={index === 0 ? firstItemRef : undefined}
                type="button"
                className={item.danger ? 'card-menu-item card-menu-item-danger' : 'card-menu-item'}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
