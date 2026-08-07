import { useState, useRef, useCallback, useEffect } from 'react'
import Button from './Button'
const Spinner = () => <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>;
import { api } from '../services/apiClient'
import { getImageUrl as getFullImageUrl } from '../../../lib/imageUtils'

export default function DragDropUpload({
  type = 'logo',
  currentUrl,
  onUploadSuccess,
  primaryColor = '#4F46E5',
  galleryId = null,
  sideBySide = false,
  compact = false,
  autoUpload = false,
  customUploadHandler = null
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)

  const validateFile = (file) => {
    // Determine expected type based on component type
    const isVideoType = type === 'video'
    const expectedPrefix = isVideoType ? 'video/' : 'image/'
    const fileTypeName = isVideoType ? 'video' : 'imagen'

    // Validate file type
    if (!file.type.startsWith(expectedPrefix)) {
      setError(`Por favor selecciona un ${fileTypeName} válido`)
      return false
    }

    // Validate file size (50MB for videos, 5MB for images)
    const maxSize = isVideoType ? 50 * 1024 * 1024 : 5 * 1024 * 1024
    const maxSizeLabel = isVideoType ? '50MB' : '5MB'
    if (file.size > maxSize) {
      setError(`El ${fileTypeName} es demasiado grande. Máximo ${maxSizeLabel}`)
      return false
    }

    return true
  }

  const handleFile = useCallback((file) => {
    if (!file || !validateFile(file)) {
      return
    }

    setSelectedFile(file)
    setError('')

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      setError('Por favor selecciona un archivo')
      return
    }

    setUploading(true)
    setError('')

    try {
      if (customUploadHandler) {
        const uploadedUrl = await customUploadHandler(selectedFile)
        setPreview(null)
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (onUploadSuccess) onUploadSuccess(uploadedUrl)
        setError('')
        return
      }

      const formData = new FormData()
      formData.append('file', selectedFile)

      let endpoint
      if (type === 'logo') {
        endpoint = '/uploads/logo'
      } else if (type === 'photo') {
        endpoint = '/uploads/photo'
      } else if (type === 'video') {
        endpoint = '/uploads/video'
      } else if (type === 'location-photo') {
        endpoint = '/uploads/location-photo'
      } else if (type === 'testimonial-photo') {
        endpoint = '/uploads/testimonial-photo'
      } else if (type === 'blog-cover') {
        endpoint = '/arko/admin/upload'
      } else if (type === 'service-image') {
        endpoint = '/uploads/service-image'
      } else if (type === 'recommendation-image') {
        endpoint = '/uploads/recommendation-image'
      } else if (type === 'certification_logo') {
        endpoint = '/uploads/certification-logo'
      } else if (type === 'gallery') {
        endpoint = '/gallery/upload'
      } else if (type === 'gallery-replace') {
        if (!galleryId) {
          throw new Error('galleryId is required for gallery-replace type')
        }
        endpoint = `/gallery/${galleryId}/image`
      } else {
        throw new Error('Invalid upload type')
      }

      const method = type === 'gallery-replace' ? 'put' : 'post'
      const response = await api[method](endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // Get the URL from response (handle different response formats)
      const uploadedUrl = response.data.logo_url || response.data.photo_url || response.data.video_url || response.data.image_url || response.data.cover_url

      if (!uploadedUrl && type !== 'gallery') {
        throw new Error('No se recibió la URL de la imagen subida')
      }

      // For gallery and gallery-replace, the entire response is the gallery image object
      if ((type === 'gallery' || type === 'gallery-replace') && response.data) {
        // Return the full gallery image object for gallery types
        if (onUploadSuccess) {
          onUploadSuccess(response.data)
        }
        setPreview(null)
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        setError('')
        return
      }

      // Clear preview and file input
      setPreview(null)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Call success callback with the uploaded URL
      if (onUploadSuccess) {
        onUploadSuccess(uploadedUrl)
      }

      // Clear any errors
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al subir el archivo. Por favor intenta de nuevo.')
    } finally {
      setUploading(false)
    }
  }, [selectedFile, type, galleryId, onUploadSuccess])

  // Auto-upload effect
  const [hasAutoUploaded, setHasAutoUploaded] = useState(false)

  // Reset auto-upload flag when file changes (cleared)
  useEffect(() => {
    if (!selectedFile) {
      setHasAutoUploaded(false)
    }
  }, [selectedFile])

  useEffect(() => {
    if (autoUpload && selectedFile && !uploading && !hasAutoUploaded) {
      console.log('Auto-uploading file:', selectedFile.name)
      setHasAutoUploaded(true)
      handleUpload()
    }
  }, [selectedFile, autoUpload, uploading, hasAutoUploaded, handleUpload])

  const handleRemove = () => {
    setPreview(null)
    setSelectedFile(null)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getImageUrl = (url) => {
    if (!url) return null
    if (url.startsWith('http')) return url

    let path = url
    if (!url.startsWith('/uploads')) {
      if (type === 'logo') {
        path = `/uploads/logos/${url}`
      } else if (type === 'photo') {
        path = `/uploads/photos/${url}`
      } else if (type === 'testimonial-photo') {
        path = `/uploads/testimonials/${url}`
      } else if (type === 'blog-cover') {
        path = `/uploads/blog/${url}`
      } else if (type === 'gallery' || type === 'gallery-replace') {
        path = `/uploads/gallery/${url}`
      }
    }

    return getFullImageUrl(path)
  }

  const displayUrl = preview || (currentUrl ? getImageUrl(currentUrl) : null)
  const hasFile = selectedFile || preview

  const getLabel = () => {
    if (type === 'logo') return 'Logo'
    if (type === 'photo') return 'Foto de Perfil'
    if (type === 'video') return 'Video'
    if (type === 'testimonial-photo') return 'Foto del Paciente'
    if (type === 'blog-cover') return 'Imagen de Portada'
    if (type === 'gallery') return 'Imagen de Galería'
    if (type === 'gallery-replace') return 'Nueva Imagen'
    if (type === 'service-image') return 'Imagen del Servicio'
    if (type === 'certification_logo') return 'Logo de Acreditación'
    return 'Imagen'
  }

  return (
    <div className={sideBySide ? "flex flex-col md:flex-row gap-8 items-start" : "space-y-4"}>
      {/* Preview */}
      {(displayUrl || sideBySide) && (
        <div className={`flex justify-center ${sideBySide ? 'w-full md:w-1/3 shrink-0' : ''}`}>
          {displayUrl ? (
            <div className="relative">
              {type === 'video' ? (
                <video
                  src={displayUrl}
                  className="max-h-64 max-w-full object-contain border-2 border-gray-300 dark:border-gray-600 rounded-lg"
                  controls
                />
              ) : ['logo', 'service-image'].includes(type) ? (
                <img
                  src={displayUrl}
                  alt="Preview"
                  className={`${compact ? 'w-32 h-32' : 'max-h-32 max-w-full'} object-contain border-2 border-gray-300 dark:border-gray-600 rounded-lg p-1`}
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              ) : type === 'gallery' || type === 'blog-cover' ? (
                <img
                  src={displayUrl}
                  alt="Preview"
                  className="max-h-64 max-w-full object-contain border-2 border-gray-300 dark:border-gray-600 rounded-lg p-2"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              ) : (
                <img
                  src={displayUrl}
                  alt="Preview"
                  className={`${type === 'testimonial-photo' ? 'w-24 h-24' : (compact ? 'w-32 h-32' : 'w-48 h-48')} object-cover shadow-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg p-1`}
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              )}
              {preview && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition"
                  title="Eliminar imagen seleccionada"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ) : sideBySide ? (
            <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-600">
              <span className="text-sm">Sin imagen</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Drag and Drop Zone Container */}
      <div className={sideBySide ? "w-full md:w-2/3 space-y-4" : "space-y-4"}>
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg ${compact ? 'p-4' : 'p-8'} text-center transition-all
            ${isDragging
              ? 'border-indigo-500 bg-indigo-50 scale-105'
              : 'border-gray-300 dark:border-gray-600'
            }
          `}
          style={isDragging ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : {}}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={type === 'video' ? 'video/*' : 'image/jpeg,image/jpg,image/png,image/webp'}
            onChange={handleFileSelect}
            className="hidden"
          />

          {!hasFile && (
            <div className="space-y-6">
              {/* Drag and Drop Section */}
              <div className="space-y-4">
                <div className="flex justify-center">
                  <svg
                    className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={isDragging ? { color: primaryColor } : {}}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDragging ? 'text-indigo-600' : 'text-gray-700'}`} style={isDragging ? { color: primaryColor } : {}}>
                    {isDragging ? 'Suelta la imagen aquí' : `Arrastra y suelta ${getLabel().toLowerCase()} aquí`}
                  </p>
                </div>
              </div>

              {/* Divider */}
              {/* Divider */}
              <div className="flex items-center w-full">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                <span className="flex-shrink-0 mx-2 text-gray-500 dark:text-gray-400 text-sm">O</span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
              </div>

              {/* File Selection Button */}
              <div className="space-y-2 flex flex-col items-center justify-center">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                  className="hover:bg-opacity-10"
                >
                  <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Seleccionar desde dispositivo
                </Button>
                <p className="text-xs text-gray-400">
                  {type === 'video' ? 'Formatos: MP4, WebM, MOV. Máximo 50MB' : 'Formatos: JPEG, PNG, WebP. Máximo 5MB'}
                </p>
              </div>
            </div>
          )}

          {hasFile && !preview && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Archivo seleccionado: {selectedFile?.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Haz clic en "Subir" para cargar la imagen
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        {hasFile && (
          <div className="flex items-center justify-center space-x-3">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              className="text-gray-700"
            >
              Cambiar Archivo
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              style={{ backgroundColor: primaryColor }}
              className="text-white"
            >
              {uploading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Subiendo...
                </>
              ) : (
                `Subir ${getLabel()}`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}



