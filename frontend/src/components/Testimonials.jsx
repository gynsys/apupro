import React, { useContext } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareQuote, Star } from 'lucide-react';
import { cmsData } from '../data/cmsData.js';
import { SiteConfigContext } from '../App.jsx';

export default function Testimonials() {
  const config = useContext(SiteConfigContext);
  const { testimonials } = cmsData;

  const dynamicTestimonials = config?.testimonials?.length > 0 ? config.testimonials : testimonials.list;

  return (
    <section className="section bg-white">
      <div className="container">
        <div className="text-center" style={{ marginBottom: 64 }}>
          <div className="section-tag">
            <MessageSquareQuote size={12} />
            {testimonials.tag}
          </div>
          <h2 className="section-title" style={{ marginBottom: 16 }}>
            {testimonials.title.line1} <br />
            <span>{testimonials.title.accent}</span>
          </h2>
          <p className="section-subtitle">
            {testimonials.subtitle}
          </p>
        </div>

        <div className="testimonials-grid">
          {dynamicTestimonials.map((item, i) => (
            <motion.div
              key={item.id || i}
              className="testimonial-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="testimonial-stars">
                {[...Array(item.stars)].map((_, index) => (
                  <Star key={index} size={16} fill="#F59E0B" color="#F59E0B" />
                ))}
              </div>
              <p className="testimonial-text">"{item.text}"</p>
              <div className="testimonial-author">
                <img src={item.avatarUrl || item.avatar} alt={item.name} />
                <div>
                  <h4>{item.name}</h4>
                  <span>{item.role}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
