import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/** One photo the viewer can show. */
export interface ViewerPhoto {
  /** Stable, unique React key. */
  id: string
  src: string
  /** Small square version for the strip of thumbnails. */
  thumbSrc: string
  alt: string
  /** Short label shown under the photo, e.g. "Your photo". */
  label: string
  /** Set for the user's own photos (the EntryPhoto id), so they can be removed. */
  ownPhotoId?: number
}

interface PhotoViewerProps {
  photos: ViewerPhoto[]
  title: string
  /** Optional controls shown under the current photo, e.g. a remove button. */
  renderActions?: (photo: ViewerPhoto) => ReactNode
}

/**
 * Step through photos one at a time: a large photo, Previous / Next
 * buttons, and a row of thumbnails to jump to any photo. Left and right
 * arrow keys also work while focus is inside the viewer.
 * Renders nothing when there are no photos.
 */
export default function PhotoViewer({ photos, title, renderActions }: PhotoViewerProps) {
  const [index, setIndex] = useState(0)
  if (photos.length === 0) return null

  // Clamp, in case the list got shorter (e.g. a photo was removed elsewhere).
  const current = Math.min(index, photos.length - 1)
  const photo = photos[current]
  const hasMany = photos.length > 1

  function show(next: number) {
    setIndex(Math.max(0, Math.min(next, photos.length - 1)))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      show(current - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      show(current + 1)
    }
  }

  return (
    <section className="viewer" aria-label={`Photos of ${title}`} onKeyDown={handleKeyDown}>
      <figure className="viewer-stage">
        <a href={photo.src} target="_blank" rel="noopener noreferrer" title="Open full size in a new tab">
          {/* key: a new <img> per photo, so the old one never lingers while the next loads. */}
          <img key={photo.id} src={photo.src} alt={photo.alt} decoding="async" />
        </a>
        <figcaption aria-live="polite">
          {photo.label}
          {hasMany && ` (${current + 1} of ${photos.length})`}
        </figcaption>
      </figure>
      {renderActions && <div className="viewer-actions">{renderActions(photo)}</div>}

      {hasMany && (
        <div className="viewer-controls">
          <button type="button" className="button" onClick={() => show(current - 1)} disabled={current === 0}>
            Previous
          </button>
          <ul className="viewer-thumbs">
            {photos.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="viewer-thumb"
                  aria-label={`Show photo ${i + 1}: ${item.label}`}
                  aria-current={i === current ? 'true' : undefined}
                  onClick={() => show(i)}
                >
                  <img src={item.thumbSrc} alt="" loading="lazy" decoding="async" width={200} height={200} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="button"
            onClick={() => show(current + 1)}
            disabled={current === photos.length - 1}
          >
            Next
          </button>
        </div>
      )}
    </section>
  )
}
