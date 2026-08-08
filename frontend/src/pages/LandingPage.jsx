import React, { useEffect } from 'react';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import PreviewSection from '../components/landing/PreviewSection';
import Footer from '../components/landing/Footer';

export default function LandingPage() {
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
      <HeroSection />
      <FeaturesSection />
      <PreviewSection />
      <Footer />
    </div>
  );
}
