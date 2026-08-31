import React from 'react';

const GLASS_STYLES = {
  normal: {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.65)',
    boxShadow: '0 4px 32px 0 rgba(80,100,200,0.08)',
  },
  strong: {
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.7)',
    boxShadow: '0 8px 40px 0 rgba(80,100,200,0.10)',
  },
};

const GlassCard = ({ strength = 'normal', className = '', children, style = {} }) => {
  return (
    <div
      className={className}
      style={{
        ...GLASS_STYLES[strength] || GLASS_STYLES.normal,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default GlassCard;