import React, { useContext } from 'react';
import { Instagram, Facebook, Linkedin, Twitter } from 'lucide-react';
import { SiteConfigContext } from '../App.jsx';

export default function Footer() {
  const config = useContext(SiteConfigContext);
  
  const siteName = config?.siteName || 'Ingeniería Arko 360';
  const logoUrl = config?.logoUrl || '/arko360/images/logo_aeko360.png';
  const social = config?.social || {};
  const phone = config?.contactPhone || '+58 412 000 0000';
  const email = config?.contactEmail || 'proyectos@arko360.com';
  const address = config?.address || 'Caracas, Venezuela';

  const handleScroll = (e, href) => {
    e.preventDefault();
    const el = document.getElementById(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <img
              src={logoUrl}
              alt={siteName}
              className="footer-logo"
            />
            <p className="footer-brand-desc">
              Transformamos espacios y construimos el futuro. Expertos en ingeniería, construcción
              y remodelaciones de alta calidad.
            </p>
            <div className="footer-social">
              {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="footer-social-btn"><Instagram size={18} /></a>}
              {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer" className="footer-social-btn"><Facebook size={18} /></a>}
              {social.linkedin && <a href={social.linkedin} target="_blank" rel="noreferrer" className="footer-social-btn"><Linkedin size={18} /></a>}
              {social.twitter && <a href={social.twitter} target="_blank" rel="noreferrer" className="footer-social-btn"><Twitter size={18} /></a>}
              {!social.instagram && !social.facebook && !social.linkedin && !social.twitter && (
                 <>
                   <a href="#" className="footer-social-btn"><Instagram size={18} /></a>
                   <a href="#" className="footer-social-btn"><Facebook size={18} /></a>
                   <a href="#" className="footer-social-btn"><Linkedin size={18} /></a>
                   <a href="#" className="footer-social-btn"><Twitter size={18} /></a>
                 </>
              )}
            </div>
          </div>

          <div>
            <h4 className="footer-col-title">Servicios</h4>
            <ul className="footer-links">
              <li><a href="#">Construcción Residencial</a></li>
              <li><a href="#">Remodelaciones Integrales</a></li>
              <li><a href="#">Diseño Arquitectónico</a></li>
              <li><a href="#">Gestión de Proyectos</a></li>
              <li><a href="#">Consultoría Estructural</a></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">Empresa</h4>
            <ul className="footer-links">
              <li><a href="#nosotros" onClick={(e) => handleScroll(e, 'nosotros')}>Sobre Nosotros</a></li>
              <li><a href="#proyectos" onClick={(e) => handleScroll(e, 'proyectos')}>Portafolio</a></li>
              <li><a href="#proceso" onClick={(e) => handleScroll(e, 'proceso')}>Metodología</a></li>
              <li><a href="#testimonios" onClick={(e) => handleScroll(e, 'testimonios')}>Testimonios</a></li>
              <li><a href="#contacto" onClick={(e) => handleScroll(e, 'contacto')}>Contacto</a></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">Contacto</h4>
            <ul className="footer-links" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
              <li style={{ marginBottom: 10 }}>
                <strong>Sede Principal:</strong><br />
                {address}
              </li>
              <li style={{ marginBottom: 10 }}>
                <strong>Teléfono:</strong><br />
                {phone}
              </li>
              <li>
                <strong>Email:</strong><br />
                {email}
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-copyright">
            &copy; {new Date().getFullYear()} {siteName}. Todos los derechos reservados.
          </div>
          <div className="footer-legal">
            <a href="#">Términos y Condiciones</a>
            <a href="#">Política de Privacidad</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
