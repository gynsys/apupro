import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function jsxSourceLocationPlugin({ types: t }) {
  return {
    visitor: {
      JSXOpeningElement(path, state) {
        const filename = state.filename || '';
        if (filename.includes('node_modules')) return;
        const normalized = filename.replace(/\\/g, '/');
        if (!normalized.includes('/src/')) return;
        const shortName = 'src/' + normalized.split('/src/')[1];
        const line = path.node.loc?.start?.line;
        const value = line ? `${shortName}:${line}` : shortName;

        path.node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier('data-source'),
            t.stringLiteral(value)
          )
        );
      }
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        plugins: mode !== 'production' ? [jsxSourceLocationPlugin] : []
      }
    })
  ],
  base: '/admin-assets/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react') || id.includes('react-icons')) {
              return 'vendor-icons';
            }
            if (id.includes('framer-motion') || id.includes('@hello-pangea')) {
              return 'vendor-ui';
            }
          }
        }
      }
    }
  },
  server: {
    port: 5174,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
}));
