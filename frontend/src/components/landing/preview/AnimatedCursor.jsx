import React from 'react';
import { motion } from 'framer-motion';

export default function AnimatedCursor({ position, visible, clicking }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-[80] hidden transition-all duration-500 ease-in-out sm:block"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        opacity: visible ? 1 : 0,
      }}
    >
      <svg
        width="26"
        height="30"
        viewBox="0 0 26 30"
        fill="none"
        className="drop-shadow-[0_4px_8px_rgba(15,23,42,0.35)]"
      >
        <path
          d="M2.6 2.1L22.4 14.4L13.2 15.8L9.1 24.6L2.6 2.1Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>

      {clicking && (
        <motion.span
          key="click-ripple"
          className="absolute -left-2 -top-2 h-9 w-9 rounded-full border-2 border-blue-500"
          initial={{ scale: 0.35, opacity: 0.9 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
    </div>
  );
}
