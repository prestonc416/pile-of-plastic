import { imageUrl } from '../images.ts'
import type { ItemImage } from '../types.ts'

/**
 * The item's photos, main photo first. Each one opens the full-size file
 * in a new tab. Renders nothing when there are no photos.
 */
export default function Gallery({ images }: { images: ItemImage[] }) {
  if (images.length === 0) return null

  return (
    <ul className={images.length === 1 ? 'gallery gallery-single' : 'gallery'} aria-label="Photos">
      {images.map((image, index) => (
        <li key={image.position}>
          <a href={imageUrl(image.path)} target="_blank" rel="noopener noreferrer">
            <img
              src={imageUrl(image.path)}
              alt={image.alt_text}
              // The first photo is usually on screen at load; the rest can wait.
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </a>
        </li>
      ))}
    </ul>
  )
}
