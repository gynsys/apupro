import React from 'react';
import { motion } from 'framer-motion';
import { Settings, PencilRuler, FileSignature, HardHat, Key } from 'lucide-react';
import { cmsData } from '../data/cmsData.js';

const iconMap = {
  Settings, PencilRuler, FileSignature, HardHat, Key
};

export default function Process() {
  const { process } = cmsData;

  return (
    <section className="section bg-alt process">
      <div className="container">
        <div className="text-center" style={{ marginBottom: 64 }}>
          <div className="section-tag">
            <Settings size={12} />
            {process.tag}
          </div>
          <h2 className="section-title" style={{ marginBottom: 16 }}>
            {process.title.line1} <br />
            <span>{process.title.accent}</span>
          </h2>
          <p className="section-subtitle">
            {process.subtitle}
          </p>
        </div>

        <div className="process-steps">
          {process.steps.map((step, i) => {
            const Icon = iconMap[step.icon];
            return (
              <motion.div
                key={step.title}
                className="process-step"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <div className="process-step-icon">
                  {Icon && <Icon size={28} strokeWidth={1.5} />}
                </div>
                <h4 className="process-step-title">{step.title}</h4>
                <p className="process-step-desc">{step.desc}</p>
                {i < process.steps.length - 1 && <div className="process-step-line" />}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
