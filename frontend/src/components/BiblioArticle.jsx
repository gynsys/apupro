import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Tag } from 'lucide-react';
import { cmsData } from '../data/cmsData.js';
// import { sanityClient } from '../lib/sanity.js';

export default function BiblioArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular fetch de Sanity, por ahora buscar en el JSON local
    const fetchArticle = async () => {
      try {
        // En el futuro para Sanity:
        // const query = `*[_type == "post" && slug.current == $slug][0]`;
        // const data = await sanityClient.fetch(query, { slug });
        
        const localArticle = cmsData.biblio.articles.find(a => a.id === slug);
        setArticle(localArticle || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [slug]);

  if (loading) return <div className="container" style={{ paddingTop: '160px', minHeight: '60vh', textAlign: 'center' }}>Cargando artículo...</div>;
  
  if (!article) return (
    <div className="container" style={{ paddingTop: '160px', minHeight: '60vh', textAlign: 'center' }}>
      <h2>Artículo no encontrado</h2>
      <Link to="/biblio" className="btn btn-primary" style={{ marginTop: '24px' }}>Volver a BiblioARKO</Link>
    </div>
  );

  return (
    <main style={{ paddingTop: '120px', paddingBottom: '96px', background: 'var(--white)' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <Link to="/biblio" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '32px', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Volver a los artículos
        </Link>
        
        <div style={{ marginBottom: '40px' }}>
          <div className="section-tag" style={{ marginBottom: '16px' }}>
            <Tag size={12} /> {article.category}
          </div>
          
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(36px, 5vw, 48px)', fontWeight: 900, color: 'var(--secondary)', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.02em' }}>
            {article.title}
          </h1>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', color: 'var(--text-muted)', fontSize: '14px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={16} />
              <span>{article.author}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} />
              <span>{article.date}</span>
            </div>
          </div>
        </div>

        <img 
          src={article.image} 
          alt={article.title} 
          style={{ width: '100%', borderRadius: '16px', marginBottom: '48px', aspectRatio: '16/9', objectFit: 'cover' }} 
        />

        <div className="article-content" style={{ fontSize: '18px', lineHeight: 1.8, color: 'var(--text)' }}>
          <p style={{ fontSize: '22px', color: 'var(--text-muted)', marginBottom: '32px', fontStyle: 'italic' }}>
            {article.excerpt}
          </p>
          
          {/* Aquí iría el renderizador de Markdown o PortableText de Sanity */}
          <p style={{ marginBottom: '24px' }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', color: 'var(--secondary)', marginTop: '40px', marginBottom: '16px' }}>La importancia de los materiales</h2>
          <p style={{ marginBottom: '24px' }}>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          </p>
        </div>
      </div>
    </main>
  );
}
