import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cmsData } from '../data/cmsData.js';
import { sanityClient } from '../lib/sanity.js';

export default function BiblioGrid({ limit = null }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Intentar buscar desde Sanity primero, si falla o no hay datos, usar mock
    const fetchArticles = async () => {
      try {
        // En el futuro, cuando Sanity esté configurado con el schema 'post':
        // const query = `*[_type == "post"] | order(publishedAt desc) {
        //   _id, title, slug, publishedAt, excerpt, "imageUrl": mainImage.asset->url, "category": categories[0]->title
        // }${limit ? `[0...${limit}]` : ''}`;
        // const data = await sanityClient.fetch(query);
        // if (data && data.length > 0) {
        //   setArticles(data);
        //   setLoading(false);
        //   return;
        // }
        
        // Fallback a los datos locales si Sanity aún no tiene artículos
        let localArticles = cmsData.biblio.articles;
        if (limit) {
          localArticles = localArticles.slice(0, limit);
        }
        setArticles(localArticles);
      } catch (err) {
        console.error("Error fetching Sanity articles:", err);
        // Fallback en caso de error
        setArticles(limit ? cmsData.biblio.articles.slice(0, limit) : cmsData.biblio.articles);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [limit]);

  if (loading) return <div className="text-center py-12">Cargando artículos...</div>;

  return (
    <div className="portfolio-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
      {articles.map((article, i) => (
        <motion.div
          key={article.id || article._id}
          className="card"
          style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
          whileHover={{ y: -8 }}
        >
          <div style={{ position: 'relative', height: '220px', overflow: 'hidden' }}>
            <img 
              src={article.imageUrl || article.image} 
              alt={article.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} 
              className="article-img"
            />
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              background: 'var(--primary)',
              color: 'var(--white)',
              padding: '4px 12px',
              borderRadius: '100px',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {article.category}
            </div>
          </div>
          
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', fontSize: '13px', marginBottom: '12px' }}>
              <Calendar size={14} />
              <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : article.date}</span>
            </div>
            
            <h3 style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--secondary)', lineHeight: 1.2, marginBottom: '12px' }}>
              <Link to={`/biblio/${article.slug?.current || article.id}`} style={{ color: 'inherit' }}>
                {article.title}
              </Link>
            </h3>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px', flex: 1 }}>
              {article.excerpt}
            </p>
            
            <Link 
              to={`/biblio/${article.slug?.current || article.id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700, fontSize: '14px' }}
            >
              Leer Artículo <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
      ))}
      <style dangerouslySetInnerHTML={{__html: `
        .card:hover .article-img {
          transform: scale(1.05);
        }
      `}} />
    </div>
  );
}
