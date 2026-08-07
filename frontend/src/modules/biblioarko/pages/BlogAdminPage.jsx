import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiHome, FiLayout, FiCheckCircle, FiEdit2, FiBookOpen } from 'react-icons/fi'
import { blogService } from '../services/blogService'

import BlogEditor from '../components/BlogEditor'
import Button from '../components/Button'
const ArkoLoader = () => <div className="p-8 text-center">Cargando...</div>;
import Modal from '../components/Modal'
import toast from 'react-hot-toast';
const useAuthStore = () => ({ user: { id: 1 } });
const getImageUrl = (url) => url;

export default function BlogAdminPage() {
  const { user } = useAuthStore()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [currentPost, setCurrentPost] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState(null)
  const [doctor, setDoctor] = useState(null)
  const showToast = (msg, type) => type === 'error' ? toast.error(msg) : toast.success(msg);

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      console.log('Loading Blog Data...')
      const [postsData, doctorData] = await Promise.all([
        blogService.getMyPosts(),
        Promise.resolve({ name: 'Admin' })
      ])
      console.log('Blog Data Loaded:', postsData)
      setPosts(Array.isArray(postsData) ? postsData : [])
      setDoctor(doctorData)
    } catch (error) {
      console.error('Error loading blog data:', error)
      showToast('Error al cargar datos', 'error')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setCurrentPost(null)
    setIsEditing(true)
  }

  const handleEdit = (post) => {
    setCurrentPost(post)
    setIsEditing(true)
  }

  const handleDeleteClick = (post) => {
    setPostToDelete(post)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!postToDelete) return

    try {
      await blogService.deletePost(postToDelete.id)
      showToast('Artículo eliminado', 'success')
      loadData()
      setDeleteModalOpen(false)
      setPostToDelete(null)
    } catch (error) {
      showToast('Error al eliminar', 'error')
    }
  }

  const handleSave = async (formData) => {
    try {
      console.log('Saving Post:', formData)
      if (currentPost) {
        await blogService.updatePost(currentPost.id, formData)
        showToast('Artículo actualizado', 'success')
      } else {
        await blogService.createPost(formData)
        showToast('Artículo creado', 'success')
      }
      setIsEditing(false)
      loadData()
    } catch (error) {
      console.error('Error saving post:', error)
      showToast('Error al guardar', 'error')
    }
  }

  if (loading && !posts.length) return <ArkoLoader />

  if (isEditing) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 pb-12 pt-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              {currentPost ? 'Editar Artículo' : 'Nuevo Artículo'}
            </h1>
          </div>
          <BlogEditor post={currentPost} onSave={handleSave} onCancel={() => setIsEditing(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 pb-12 pt-6">
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión del Blog</h1>
            <Button onClick={handleCreate} variant="primary" primaryColor={doctor?.theme_primary_color}>
              Nuevo Artículo
            </Button>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {Array.isArray(posts) && posts.map((post) => (
              <li key={post.id} className="dark:bg-gray-800">
                <div className="px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Content */}
                  <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                    <div className="flex-shrink-0 h-16 w-16">
                      {post.cover_image ? (
                        <img
                          className="h-16 w-16 rounded-lg object-cover"
                          src={getImageUrl(post.cover_image)}
                          alt=""
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <FiLayout className="h-8 w-8 text-gray-300 dark:text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">{post.title}</h3>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1">
                          {post.is_published ? (
                            <>
                              <FiCheckCircle className="text-green-500" />
                              <span className="text-green-700 dark:text-green-400">Publicado</span>
                            </>
                          ) : (
                            <>
                              <FiEdit2 className="text-amber-500" />
                              <span className="text-amber-700 dark:text-amber-400">Borrador</span>
                            </>
                          )}
                        </span>
                        <span>• {new Date(post.created_at).toLocaleDateString()}</span>
                        {post.is_in_menu && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 gap-1" title="Visible en Contenido">
                            <FiBookOpen /> En Contenido
                          </span>
                        )}
                        {/* SEO Score Badge */}
                        {post.seo_config && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium gap-1 ${post.seo_config.seo_score >= 70 ? 'bg-green-100 text-green-800' :
                            post.seo_config.seo_score >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                            }`}>
                            SEO: {post.seo_config.seo_score}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2 w-full sm:w-auto justify-end">
                    <Button
                      onClick={() => handleEdit(post)}
                      variant="outline"
                      size="sm"
                      primaryColor={doctor?.theme_primary_color}
                    >
                      Editar
                    </Button>

                    <Button
                      onClick={() => handleDeleteClick(post)}
                      variant="primary"
                      size="sm"
                      primaryColor={doctor?.theme_primary_color}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
            {(!posts || posts.length === 0) && (
              <li className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No tienes artículos aún. ¡Crea el primero!
              </li>
            )}
          </ul>
        </div>

        <Modal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Eliminar Artículo"
        >
          <div className="mt-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ¿Estás seguro de que quieres eliminar el artículo "{postToDelete?.title}"? Esta acción no se puede deshacer.
            </p>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
            >
              Eliminar
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  )
}




