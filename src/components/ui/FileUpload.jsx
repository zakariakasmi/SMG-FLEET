import { Upload01 } from '@untitledui/icons'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FileUpload({
  accept,
  onChange,
  label,
  description,
  error,
  maxSize = 10 * 1024 * 1024, // 10MB
}) {
  const { t } = useTranslation()
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef(null)

  const displayLabel = label || t('ui.uploadFile')

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      validateAndUpload(file)
    }
  }

  const handleChange = (e) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      validateAndUpload(file)
    }
  }

  const validateAndUpload = (file) => {
    if (file.size > maxSize) {
      onChange(null, t('ui.fileSizeLimit', { maxSize: maxSize / (1024 * 1024) }))
      return
    }
    onChange(file, null)
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  const borderColor = error
    ? 'border-destructive'
    : dragActive
      ? 'border-primary'
      : 'border-dashed border-border'

  return (
    <div className="w-full">
      {displayLabel && (
        <label className="mb-2 block text-sm font-medium text-muted-foreground">
          {displayLabel}
        </label>
      )}
      <div
        className={`relative cursor-pointer rounded-lg border-2 p-8 text-center transition-colors ${
          dragActive ? 'bg-muted/60 border-solid border-primary' : `${borderColor} bg-background hover:border-primary/50`
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleChange}
        />
        <Upload01 className="mx-auto h-12 w-12 text-muted-foreground/60" />
        <p className="mt-2 text-sm text-foreground">
          {t('ui.dragDrop')}
        </p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}