import { useState } from 'react'
import { imageUrl } from '../images.ts'
import type { Item } from '../types.ts'

/** Must match THUMB_PX in backend/prepare_images.py. */
const THUMB_SOURCE_PX = 200

/**
 * Small square photo of an item for lists, or a plain placeholder box when
 * the item has no photo or the file fails to load.
 *
 * The image is decorative here (alt=""): it always sits next to the figure's
 * name, so describing it would make screen readers announce the item twice.
 * The item page shows the photos with their real alt text.
 */
export default function Thumbnail({ item }: { item: Item }) {
  const [failed, setFailed] = useState(false)
  const first = item.images[0]

  if (first === undefined || failed) {
    return <span className="thumb thumb-empty" aria-hidden="true" />
  }
  return (
    <img
      className="thumb"
      src={imageUrl(first.thumb_path)}
      alt=""
      width={THUMB_SOURCE_PX}
      height={THUMB_SOURCE_PX}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
