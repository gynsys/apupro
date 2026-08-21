import React, { useState, useEffect } from 'react';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import PreviewSection from '../components/landing/PreviewSection';
import Footer from '../components/landing/Footer';
import Header from '../components/landing/Header';
import LoginModal from '../components/landing/LoginModal';
import RegisterModal from '../components/landing/RegisterModal';

export default function LandingPage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  // Smooth scroll logic (optional, for hash links)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, []);

  return (
    <div className="font-sans antialiased text-slate-900 bg-slate-950 selection:bg-blue-500/30">
      <Header onLoginClick={() => setIsLoginModalOpen(true)} />
      <HeroSection onLoginClick={() => setIsLoginModalOpen(true)} />
      <FeaturesSection />
      <PreviewSection />
      <Footer />
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onSwitchToRegister={() => {
          setIsLoginModalOpen(false);
          setIsRegisterModalOpen(true);
        }}
      />
      <RegisterModal 
        isOpen={isRegisterModalOpen} 
        onClose={() => setIsRegisterModalOpen(false)} 
        onSwitchToLogin={() => {
          setIsRegisterModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />
    </div>
  );
}
