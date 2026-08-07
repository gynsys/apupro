import { useState, useEffect, useRef } from 'react'
import ReactQuill, { Quill } from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import ImageResize from 'quill-image-resize-module-react'
import { FiCpu, FiPlus, FiSave, FiX, FiInfo } from 'react-icons/fi'
import { blogService } from '../services/blogService'
import { api } from '../services/apiClient'
import Button from './Button'
import DragDropUpload from './DragDropUpload'
const useAuthStore = () => ({ user: { id: 1, theme_primary_color: '#000000' } });
import toast from 'react-hot-toast';
import Modal from './Modal'
import SEOConfiguration from './SEOConfiguration'
const Spinner = () => <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>;

// Custom Image Blot to persist inline styles (alignment) and dimensions
const BaseImage = Quill.import('formats/image')

class ImageBlot extends BaseImage {
  static create(value) {
    const node = super.create(value)
    if (typeof value === 'string') {
      node.setAttribute('src', value)
    } else if (typeof value === 'object') {
      // Handle object values if passed
      if (value.url) node.setAttribute('src', value.url)
      // Apply persisted attributes
      if (value.alt) node.setAttribute('alt', value.alt)
      if (value.width) node.setAttribute('width', value.width)
      if (value.height) node.setAttribute('height', value.height)
      if (value.style) node.setAttribute('style', value.style)
    }
    return node
  }

  static value(node) {
    return {
      url: node.getAttribute('src'),
      alt: node.getAttribute('alt'),
      width: node.getAttribute('width'),
      height: node.getAttribute('height'),
      style: node.getAttribute('style') // Crucial for persist floats
    }
  }
}
ImageBlot.blotName = 'image'
ImageBlot.tagName = 'img'
Quill.register(ImageBlot, true)

// Register Image Resize Module
Quill.register('modules/imageResize', ImageResize)

const modules = {
  toolbar: {
    container: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub' }, { 'script': 'super' }],
      [{ 'align': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image', 'video'],
      ['clean']
    ],
  },
  imageResize: {
    parchment: Quill.import('parchment'),
    modules: ['Resize', 'DisplaySize', 'Toolbar']
  }
}

export default function BlogEditor({ post, onSave, onCancel }) {
  const { user } = useAuthStore() // Get current doctor info for SEO generation
  const showToast = (msg, type) => type === 'error' ? toast.error(msg) : toast.success(msg);
  const summaryRef = useRef(null)
  const quillRef = useRef(null)
  
  // AI States
  const [generating, setGenerating] = useState(false)
  const [aiExpanded, setAiExpanded] = useState(false)
  const [aiForm, setAiForm] = useState({
    topic: '',
    pdf_file: null,
    tone: 'Profesional',
    target_audience: 'Arquitectos e Ingenieros',
    max_words: 500
  })

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    cover_image: '',
    is_published: false,
    is_in_menu: false,
    menu_weight: 0,
    menu_icon: ''
  })

  // Initialize SEO state
  const [seoData, setSeoData] = useState({
    meta_title: '',
    meta_description: '',
    focus_keyword: '',
    canonical_url: '',
    schema_type: 'Article',
    robots_index: true,
    robots_follow: true,
    social_title: '',
    social_description: '',
    social_image: ''
  })

  // Custom Image Handler for Quill
  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (file) {
        const loadingToast = toast.loading('Subiendo imagen...');
        try {
          const uploadData = new FormData();
          uploadData.append('file', file);
          const response = await api.post('/arko/admin/upload', uploadData);
          
          if (response.data && response.data.image_url) {
            const quill = quillRef.current.getEditor();
            const range = quill.getSelection();
            quill.insertEmbed(range.index, 'image', response.data.image_url);
            quill.setSelection(range.index + 1);
            toast.success('Imagen subida', { id: loadingToast });
          } else {
            throw new Error('No url in response');
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          toast.error('Error al subir imagen', { id: loadingToast });
        }
      }
    };
  };

  useEffect(() => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      quill.getModule('toolbar').addHandler('image', imageHandler);
    }
  }, []);

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        content: post.content,
        summary: post.summary || '',
        cover_image: post.cover_image || '',
        is_published: post.is_published,
        is_in_menu: post.is_in_menu || false,
        menu_weight: post.menu_weight || 0,
        menu_icon: post.menu_icon || ''
      })
      if (post.seo_config) {
        setSeoData(post.seo_config)
      }
    }
  }, [post])

  useEffect(() => {
    if (summaryRef.current) {
      summaryRef.current.style.height = 'auto'
      summaryRef.current.style.height = summaryRef.current.scrollHeight + 'px'
    }
  }, [formData.summary])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleContentChange = (content) => {
    setFormData(prev => ({
      ...prev,
      content: content
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Merge SEO data into submission
    const dataToSave = {
      ...formData,
      seo_config: seoData
    }
    console.log('Submitting Blog Post:', dataToSave)
    onSave(dataToSave)
  }

  const handleCoverUpload = (url) => {
    console.log('Cover Image Upload Success:', url)
    setFormData(prev => ({
      ...prev,
      cover_image: url
    }))
  }

  const handleAiGenerate = async (e) => {
    e.preventDefault()
    if (!aiForm.topic && !aiForm.pdf_file) {
      showToast('Por favor ingresa un tema o adjunta un PDF', 'error')
      return
    }

    try {
      setGenerating(true)
      const response = await blogService.generateAI(aiForm)
      
      // Super-paste method for Quill with delay to ensure state sync
      if (quillRef.current) {
        const quill = quillRef.current.getEditor();
        quill.setText(''); 
        setTimeout(() => {
          quill.clipboard.dangerouslyPasteHTML(response.generated_content);
        }, 150);
      }
      
      setFormData(prev => ({
        ...prev,
        title: response.title || prev.title || aiForm.topic,
        summary: response.summary || prev.summary,
        content: response.generated_content
      }))
      
      showToast('¡Contenido generado exitosamente!', 'success')
      setAiExpanded(false)
    } catch (error) {
      console.error('Error generating AI content:', error)
      showToast(error.response?.data?.detail || 'Error al generar contenido', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">

      {/* Main Content Column (Left) */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* AI Assistant Section */}
        <div className={`bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800 p-6 rounded-lg border border-indigo-100 dark:border-indigo-900/30 shadow-sm transition-all duration-300 ${aiExpanded ? 'opacity-100' : 'opacity-90'}`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <FiCpu className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase tracking-wider">Asistente de IA ✨</h3>
            </div>
            <button 
              type="button"
              onClick={() => setAiExpanded(!aiExpanded)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {aiExpanded ? 'Ocultar opciones' : 'Configurar generación'}
            </button>
          </div>

          <div className={`space-y-4 ${aiExpanded ? 'block' : 'hidden md:block'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Tema o Título del Artículo</label>
                <input
                  type="text"
                  value={aiForm.topic}
                  onChange={(e) => setAiForm({...aiForm, topic: e.target.value})}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border"
                  placeholder="Ej: Tendencias de diseño arquitectónico 2026"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Adjuntar PDF de Referencia</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setAiForm({...aiForm, pdf_file: e.target.files[0]})}
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Tono</label>
                <select
                  value={aiForm.tone}
                  onChange={(e) => setAiForm({...aiForm, tone: e.target.value})}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border"
                >
                  <option>Profesional</option>
                  <option>Empático</option>
                  <option>Informativo</option>
                  <option>Directo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Público Objetivo</label>
                <select
                  value={aiForm.target_audience}
                  onChange={(e) => setAiForm({...aiForm, target_audience: e.target.value})}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border"
                >
                  <option>Público en general</option>
                  <option>Ingenieros y Arquitectos</option>
                  <option>Constructores y Contratistas</option>
                  <option>Estudiantes de ingeniería</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Extensión</label>
                <select
                  value={aiForm.max_words}
                  onChange={(e) => setAiForm({...aiForm, max_words: parseInt(e.target.value)})}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border"
                >
                  <option value={300}>Corto (~300 p.)</option>
                  <option value={500}>Medio (~500 p.)</option>
                  <option value={800}>Largo (~800 p.)</option>
                  <option value={1200}>Extenso (~1200 p.)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button 
                type="button" 
                onClick={handleAiGenerate} 
                disabled={generating}
                variant="primary"
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    Generando artículo...
                  </>
                ) : (
                  <>
                    <FiCpu className="w-4 h-4" />
                    Generar Contenido con IA
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título de la Entrada</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg p-3 border"
              placeholder="Escribe un título atractivo..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resumen / Extracto</label>
            <textarea
              ref={summaryRef}
              name="summary"
              rows={2}
              value={formData.summary}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border overflow-hidden resize-none"
              placeholder="Breve descripción para listas y tarjetas..."
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contenido Principal</label>
            </div>
            <div className="min-h-[500px] mb-12 bg-white dark:bg-gray-900">
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={formData.content}
                onChange={handleContentChange}
                className="h-full dark:text-white"
                modules={modules}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Column (Right) */}
      <div className="lg:col-span-1 space-y-6">

        {/* Publish Actions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-md font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Publicación</h3>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="is_published"
                name="is_published"
                type="checkbox"
                checked={formData.is_published}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="is_published" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Publicar inmediatamente
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" variant="primary" className="w-full justify-center">
                {post ? 'Actualizar Entrada' : 'Publicar Entrada'}
              </Button>
              <Button type="button" variant="secondary" onClick={onCancel} className="w-full justify-center">
                Cancelar
              </Button>
            </div>
          </div>
        </div>

        {/* Featured Image */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-md font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 mb-2">Imagen Destacada</h3>
          <DragDropUpload
            type="blog-cover"
            currentUrl={formData.cover_image}
            onUploadSuccess={handleCoverUpload}
            compact={true}
            autoUpload={true}
          />
        </div>

        {/* SEO Configuration */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <SEOConfiguration
            seoData={seoData}
            onChange={setSeoData}
            postTitle={formData.title}
            postContent={formData.content}
            doctorName={user?.nombre_completo}
          />
        </div>

        {/* Mega Menu Config */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-md font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">Opciones de Menú</h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="is_in_menu"
                  type="checkbox"
                  name="is_in_menu"
                  checked={formData.is_in_menu}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="is_in_menu" className="font-medium text-gray-700 dark:text-gray-300">Aparecer en Mega Menú</label>
                <p className="text-gray-500 text-xs">Mostrar en el menú principal del sitio</p>
              </div>
            </div>

            {formData.is_in_menu && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre Corto / Icono</label>
                <input
                  type="text"
                  name="menu_icon"
                  value={formData.menu_icon}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  placeholder="Ej: Endometriosis"
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </form>
  )
}





