import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
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
        ]
      }
    })
  ],
  base: '/admin-assets/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
