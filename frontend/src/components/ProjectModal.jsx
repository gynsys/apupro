import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function ProjectModal({ project, onClose }) {
  if (!project) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal"
          initial={{ opacity: 0, scale: 0.92, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>

          <img
            src={project.imageUrl || project.image}
            alt={project.title}
            className="modal-image"
          />

          <div className="modal-content">
            <div className="modal-tag">{project.category}</div>
            <h2 className="modal-title">{project.title}</h2>
            <p className="modal-desc">{project.description}</p>

            <div className="modal-meta">
              <div className="modal-meta-item">
                <div className="modal-meta-label">Duración</div>
                <div className="modal-meta-value">{project.duration}</div>
              </div>
              <div className="modal-meta-item">
                <div className="modal-meta-label">Área</div>
                <div className="modal-meta-value">{project.area}</div>
              </div>
              <div className="modal-meta-item">
                <div className="modal-meta-label">Año</div>
                <div className="modal-meta-value">{project.year}</div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
