// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Site configuration
  site: 'https://hn-buddy.com/',
  
  // Output mode for server-side rendering
  output: 'server',
  
  // Use Cloudflare adapter
  adapter: cloudflare({
    // Optional: Specify routes that should be pre-rendered
    // routes: {
    //   strategy: 'include',
    //   entrypoints: ['src/pages/index.astro']
    // }
  }),
  
  // Build configuration
  build: {
    // Astro asset settings
    assets: '_astro',
  },
  
  // Optimization settings
  vite: {
    build: {
      // Enable minification
      minify: true,
      // Chunk sizes
      chunkSizeWarningLimit: 1000,
    },
    ssr: {
      noExternal: [],
    },
  }
});
