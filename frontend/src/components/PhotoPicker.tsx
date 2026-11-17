import { useId, useState } from 'react'
import type { ChangeEvent } from 'react'
import { checkPhotoFile, MAX_PHOTOS_PER_ENTRY, PHOTO_ACCEPT } from '../photos.ts'
import FilePreview from './FilePreview.tsx'

interface PhotoPickerProps {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}

/**
 * Pick up to MAX_PHOTOS_PER_ENTRY photos, with previews, before saving.
 * Nothing is uploaded here; the parent uploads after the entry is created.
 */
export default function PhotoPicker({ files, onChange, disabled = false }: PhotoPickerProps) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const remaining = MAX_PHOTOS_PER_ENTRY - files.length

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    // Clear the input so choosing the same file again still fires onChange.
    event.target.value = ''
    const problems: string[] = []
    const accepted: File[] = []
    for (const file of picked) {
      const problem = checkPhotoFile(file)
      if (problem !== null) problems.push(problem)
      else accepted.push(file)
    }
    if (accepted.length > remaining) {
      problems.push(`You can add ${MAX_PHOTOS_PER_ENTRY} photos per copy. Only the first ${remaining} were kept.`)
    }
    setError(problems.length > 0 ? problems.join(' ') : null)
    if (accepted.length > 0) onChange([...files, ...accepted.slice(0, remaining)])
  }

  return (
    <div className="field" role="group" aria-labelledby={`${id}-label`}>
      <span className="field-label" id={`${id}-label`}>
        Your photos
      </span>
      {files.length > 0 && (
        <ul className="photo-strip">
          {files.map((file, index) => (
            // File objects have no id; the index is stable while this list exists.
            <li key={`${index}-${file.name}-${file.lastModified}`} className="photo-tile">
              <FilePreview file={file} alt={`Preview of ${file.name}`} />
              <button
                type="button"
                className="button button-small"
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                onClick={() => {
                  setError(null)
                  onChange(files.filter((_, i) => i !== index))
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {remaining > 0 && (
        <label className={disabled ? 'button file-button is-disabled' : 'button file-button'}>
          {files.length === 0 ? 'Choose photos' : 'Choose another photo'}
          <input
            type="file"
            className="visually-hidden"
            accept={PHOTO_ACCEPT}
            multiple={remaining > 1}
            disabled={disabled}
            aria-describedby={`${id}-hint`}
            onChange={handlePick}
          />
        </label>
      )}
      <p className="field-hint" id={`${id}-hint`}>
        Optional. Up to {MAX_PHOTOS_PER_ENTRY} JPG, PNG, or WebP photos, 10 MB each. Only you see these.
      </p>
      {error !== null && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
