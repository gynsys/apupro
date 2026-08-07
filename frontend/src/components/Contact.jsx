import React, { useContext } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { useContactForm } from '../hooks/useContactForm.js';
import { SiteConfigContext } from '../App.jsx';

const DEFAULT_WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER || '+58XXXXXXXXXX';

export default function Contact() {
  const config = useContext(SiteConfigContext);
  const WHATSAPP = config?.contactPhone || DEFAULT_WHATSAPP;
  const email = config?.contactEmail || 'proyectos@arko360.com';
  const address = config?.address || 'Caracas, Venezuela';

  const { register, handleSubmit, errors, status, errorMessage, resetForm, isLoading, isSuccess, isError } = useContactForm();

  return (
    <section id="contacto" className="section contact">
      <div className="container">
        <motion.div
          className="text-center"
          style={{ marginBottom: 64 }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="section-tag" style={{ margin: '0 auto 16px' }}>
            <Mail size={12} />
            Contacto
          </div>
          <h2 className="section-title">
            ¿Listo para construir <span>tu próximo proyecto?</span>
          </h2>
          <p className="section-subtitle" style={{ marginTop: 16 }}>
            Escríbenos y nuestro equipo de ingenieros se pondrá en contacto contigo a la brevedad posible.
          </p>
        </motion.div>

        <div className="contact-grid">
          {/* Info Side */}
          <motion.div
            className="contact-info"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h3 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>Hablemos de tu proyecto</h3>
            <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.7)' }}>
              Ya sea una remodelación residencial o una construcción comercial desde cero, estamos aquí para ayudarte a materializar tus ideas.
            </p>

            <div className="contact-info-items">
              <div className="contact-info-item">
                <div className="contact-info-icon"><Phone size={20} /></div>
                <div>
                  <div className="contact-info-label">Teléfono / WhatsApp</div>
                  <div className="contact-info-value">{WHATSAPP}</div>
                </div>
              </div>
              <div className="contact-info-item">
                <div className="contact-info-icon"><Mail size={20} /></div>
                <div>
                  <div className="contact-info-label">Correo Electrónico</div>
                  <div className="contact-info-value">{email}</div>
                </div>
              </div>
              <div className="contact-info-item">
                <div className="contact-info-icon"><MapPin size={20} /></div>
                <div>
                  <div className="contact-info-label">Ubicación Principal</div>
                  <div className="contact-info-value">{address}</div>
                </div>
              </div>
            </div>

            <a
              href={`https://wa.me/${WHATSAPP.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-btn"
            >
              Chatear por WhatsApp
            </a>
          </motion.div>

          {/* Form Side */}
          <motion.div
            className="contact-form-wrap"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            {isSuccess ? (
              <div className="form-success">
                <div className="form-success-icon"><CheckCircle2 size={36} /></div>
                <h3>¡Mensaje Enviado!</h3>
                <p>Gracias por contactarnos. Nuestro equipo revisará tu solicitud y te responderemos en breve.</p>
                <button
                  className="btn btn-outline"
                  style={{ marginTop: 24 }}
                  onClick={resetForm}
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <>
                <h3 className="form-title">Envíanos un mensaje</h3>
                <p className="form-subtitle">Completa el formulario y te enviaremos una cotización preliminar.</p>

                {isError && (
                  <div style={{ padding: 12, background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
                    {errorMessage}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Nombre Completo</label>
                      <input
                        type="text"
                        className={`form-input ${errors.name ? 'error' : ''}`}
                        placeholder="Ej. Juan Pérez"
                        {...register('name', { required: 'El nombre es requerido' })}
                      />
                      {errors.name && <span className="form-error">{errors.name.message}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Correo Electrónico</label>
                      <input
                        type="email"
                        className={`form-input ${errors.email ? 'error' : ''}`}
                        placeholder="juan@ejemplo.com"
                        {...register('email', {
                          required: 'El correo es requerido',
                          pattern: { value: /^\S+@\S+$/i, message: 'Correo inválido' }
                        })}
                      />
                      {errors.email && <span className="form-error">{errors.email.message}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Teléfono</label>
                      <input
                        type="tel"
                        className={`form-input ${errors.phone ? 'error' : ''}`}
                        placeholder="+58 412 123 4567"
                        {...register('phone', { required: 'El teléfono es requerido' })}
                      />
                      {errors.phone && <span className="form-error">{errors.phone.message}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Tipo de Proyecto</label>
                      <select
                        className={`form-input ${errors.project_type ? 'error' : ''}`}
                        {...register('project_type', { required: 'Selecciona una opción' })}
                      >
                        <option value="">Selecciona una opción...</option>
                        <option value="Construcción Residencial">Construcción Residencial</option>
                        <option value="Remodelación Integral">Remodelación Integral</option>
                        <option value="Diseño Arquitectónico">Diseño Arquitectónico</option>
                        <option value="Comercial / Oficinas">Comercial / Oficinas</option>
                        <option value="Otro">Otro</option>
                      </select>
                      {errors.project_type && <span className="form-error">{errors.project_type.message}</span>}
                    </div>

                    <div className="form-group form-group-full">
                      <label className="form-label">Mensaje o Detalles del Proyecto</label>
                      <textarea
                        className={`form-input ${errors.message ? 'error' : ''}`}
                        placeholder="Cuéntanos un poco sobre lo que tienes en mente..."
                        {...register('message', { required: 'El mensaje es requerido' })}
                      ></textarea>
                      {errors.message && <span className="form-error">{errors.message.message}</span>}
                    </div>
                  </div>

                  <button type="submit" className="form-submit" disabled={isLoading}>
                    {isLoading ? 'Enviando...' : (
                      <>
                        Enviar Solicitud <Send size={18} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
