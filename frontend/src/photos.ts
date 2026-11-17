/**
 * Rules for photos users attach to their own copies. These mirror
 * backend/app/services/photos.py so users get instant feedback; the server
 * checks again and is the one that decides.
 */

export const MAX_PHOTOS_PER_ENTRY = 2
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

/**
 * For the file input's `accept` attribute. On iPhones, Safari converts HEIC
 * photos to JPEG automatically when HEIC isn't listed here.
 */
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Check a picked file before uploading.
 * @returns an error message to show, or null if the file looks fine.
 */
export function checkPhotoFile(file: File): string | null {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/.test(file.type)
  if (isHeic) {
    return `${file.name} is a HEIC photo. Export it as JPG first, or on iPhone set Settings > Camera > Formats to Most Compatible.`
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return `${file.name} isn't a JPG, PNG, or WebP photo.`
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `${file.name} is over 10 MB. Choose a smaller photo.`
  }
  if (file.size === 0) {
    return `${file.name} is empty.`
  }
  return null
}
