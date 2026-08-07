import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, FolderOpen } from 'lucide-react';
import ProjectModal from './ProjectModal.jsx';
import { cmsData } from '../data/cmsData.js';
import { SiteConfigContext } from '../App.jsx';

export default function Portfolio() {
  const config = useContext(SiteConfigContext);
  const { portfolio } = cmsData;
  const [filter, setFilter] = useState('Todos');
  const [selectedProject, setSelectedProject] = useState(null);

  const dynamicProjects = config?.portfolio?.length > 0 ? config.portfolio : portfolio.projects;

  const filteredProjects = filter === 'Todos'
    ? dynamicProjects
    : dynamicProjects.filter(p => p.category === filter);

  return (
    <section id="proyectos" className="section portfolio">
      <div className="container">
        <div className="text-center" style={{ marginBottom: 48 }}>
          <div className="section-tag">
            <FolderOpen size={12} />
            {portfolio.tag}
          </div>
          <h2 className="section-title" style={{ marginBottom: 16 }}>
            {portfolio.title.line1} <br />
            <span>{portfolio.title.accent}</span>
          </h2>
          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {portfolio.subtitle}
          </p>

          <div className="portfolio-filters" style={{ justifyContent: 'center' }}>
            {portfolio.categories.map(cat => (
              <button
                key={cat}
                className={`filter-btn ${filter === cat ? 'active' : ''}`}
                onClick={() => setFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <motion.div layout className="portfolio-grid">
          <AnimatePresence>
            {filteredProjects.map((project) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                key={project.id || project.title}
                className="portfolio-item"
                onClick={() => setSelectedProject(project)}
              >
                <img src={project.imageUrl || project.image} alt={project.title} />
                <div className="portfolio-item-overlay">
                  <div className="portfolio-item-info">
                    <h3>{project.title}</h3>
                    <p>{project.category}</p>
                  </div>
                </div>
                <div className="portfolio-item-icon">
                  <ZoomIn size={24} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </section>
  );
}
