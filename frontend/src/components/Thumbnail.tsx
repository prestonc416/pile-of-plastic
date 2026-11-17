import { useState } from 'react'
import { imageUrl } from '../images.ts'
import type { EntryPhoto, Item } from '../types.ts'

/** Must match THUMB_PX in backend/prepare_images.py and services/photos.py. */
const THUMB_SOURCE_PX = 200

/**
 * Small square photo of an item for lists, or a plain placeholder box when
 * the item has no photo or the file fails to load. Pass `ownPhoto` to show
 * the user's own photo of their copy instead of the catalog photo.
 *
 * The image is decorative here (alt=""): it always sits next to the figure's
 * name, so describing it would make screen readers announce the item twice.
 * The item page shows the photos with their real alt text.
 */
export default function Thumbnail({ item, ownPhoto }: { item: Item; ownPhoto?: EntryPhoto }) {
  // Remember WHICH source failed, so a new source (e.g. after the user adds
  // their own photo) gets a fresh try instead of staying a placeholder.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const catalogThumb = item.images[0]?.thumb_path
  const src = ownPhoto?.thumb_url ?? (catalogThumb !== undefined ? imageUrl(catalogThumb) : undefined)

  if (src === undefined || src === failedSrc) {
    return <span className="thumb thumb-empty" aria-hidden="true" />
  }
  return (
    <img
      className="thumb"
      src={src}
      alt=""
      width={THUMB_SOURCE_PX}
      height={THUMB_SOURCE_PX}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  )
}
