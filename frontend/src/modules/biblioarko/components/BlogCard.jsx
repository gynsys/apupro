import { Link, useParams } from 'react-router-dom'
const SocialLinks = () => null;
import { getImageUrl } from '../../../lib/imageUtils'

export default function BlogCard({ post, doctor, shadow = true }) {
  const { slug } = useParams()
  // If theme is dark, we ignore the custom container color to let dark mode classes work
  const isDarkTheme = doctor?.design_template === 'dark'
  const containerBgColor = isDarkTheme ? null : doctor?.theme_container_bg_color

  return (
    <div className={`flex flex-col overflow-hidden rounded-lg transition-transform hover:scale-105 duration-300 ${shadow ? 'shadow-lg' : 'border border-gray-200 dark:border-gray-700'}`}>
      <div className="flex-shrink-0">
        <img
          className="h-48 w-full object-cover"
          src={getImageUrl(post.cover_image) || "https://images.unsplash.com/photo-1496128858413-b36217c2ce36?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1679&q=80"}
          alt={post.title}
        />
      </div>
      <div
        className={`flex flex-1 flex-col justify-between p-6 transition-colors duration-200 ${!containerBgColor ? 'bg-white dark:bg-gray-800' : ''}`}
        style={containerBgColor ? { backgroundColor: containerBgColor } : {}}
      >
        <div className="flex-1">
          <Link to={`/${slug}/blog/${post.slug}`} className="mt-2 block">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400">{post.title}</h3>
            <p className="mt-3 text-base text-gray-500 dark:text-gray-300 line-clamp-5">
              {post.summary || post.content.replace(/<[^>]*>?/gm, '').substring(0, 250) + '...'}
            </p>
          </Link>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <time dateTime={post.published_at}>
              {new Date(post.published_at || post.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          </div>
          <Link to={`/${slug}/blog/${post.slug}`} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
            Leer más &rarr;
          </Link>
        </div>
        {/* Social Links at bottom right */}
        <div className="mt-4 flex justify-end">
          <SocialLinks
            doctor={doctor}
            className="!px-4 !py-1 !rounded-lg scale-75 origin-right"
            iconClassName="w-5 h-5"
          />
        </div>
      </div>
    </div>
  )
}



