import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { cmsData } from '../data/cmsData.js';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: [0.4, 0, 0.2, 1] },
  }),
};

export default function Hero() {
  const { hero } = cmsData;

  const handleScroll = (e, href) => {
    e.preventDefault();
    const el = document.getElementById(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="inicio" className="hero">
      <div className="hero-bg" />
      <div className="hero-overlay" />

      <div className="container" style={{ padding: '120px 24px 160px', position: 'relative', zIndex: 2 }}>
        <motion.div
          className="hero-content"
          initial="hidden"
          animate="visible"
        >
          <motion.div className="hero-badge" variants={fadeUp} custom={0}>
            <span className="hero-badge-dot" />
            {hero.badge}
          </motion.div>

          <motion.h1 className="hero-title" variants={fadeUp} custom={0.15}>
            {hero.title.line1}<br />
            <span className="hero-title-accent">{hero.title.accent}</span><br />
            {hero.title.line2}
          </motion.h1>

          <motion.p className="hero-subtitle" variants={fadeUp} custom={0.3}>
            {hero.subtitle}
          </motion.p>

          <motion.div className="hero-actions" variants={fadeUp} custom={0.45}>
            <a
              href="#contacto"
              className="btn btn-primary btn-lg"
              onClick={(e) => handleScroll(e, 'contacto')}
            >
              {hero.ctaPrimary}
              <ArrowRight size={18} />
            </a>
            <a
              href="#proyectos"
              className="btn btn-outline btn-lg"
              style={{ color: 'white', borderColor: 'white' }}
              onClick={(e) => handleScroll(e, 'proyectos')}
            >
              {hero.ctaSecondary}
            </a>
          </motion.div>
        </motion.div>
      </div>

      <motion.a
        href="#servicios"
        onClick={(e) => handleScroll(e, 'servicios')}
        style={{
          position: 'absolute',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
          color: 'rgba(255,255,255,0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span>Explorar</span>
        <ChevronDown size={20} />
      </motion.a>

      <div className="hero-stats">
        <div className="hero-stats-inner">
          {hero.stats.map((stat) => (
            <div className="hero-stat" key={stat.label}>
              <div className="hero-stat-number">{stat.number}</div>
              <div className="hero-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
