import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://back-office.pierre-coutherut.fr',
  output: 'static',
  trailingSlash: 'always',
  integrations: [react()],
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()], build: { sourcemap: false } },
});
