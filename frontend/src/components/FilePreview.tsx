import { useEffect, useRef } from 'react'

/**
 * Preview of a file the user picked but has not uploaded yet.
 *
 * The preview URL (URL.createObjectURL) holds the file in memory until it is
 * revoked. Creating it inside the effect and revoking it in the cleanup
 * frees it whenever the file changes or the preview goes away, so picking
 * and removing photos repeatedly never leaks memory. Setting `src` through a
 * ref keeps this out of React state.
 */
export default function FilePreview({ file, alt }: { file: File; alt: string }) {
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (imgRef.current) imgRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  return <img ref={imgRef} className="photo-tile-img" alt={alt} />
}
