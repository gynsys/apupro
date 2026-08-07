import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || 'ao4wep1o',
  dataset: import.meta.env.VITE_SANITY_DATASET || 'production',
  useCdn: true, // Use CDN for fast, cacheable reads
  apiVersion: import.meta.env.VITE_SANITY_API_VERSION || '2023-05-03',
  // token: import.meta.env.VITE_SANITY_TOKEN // Only needed for private datasets or writing data
});
