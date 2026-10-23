import { defineConfig } from 'tsup';
import { fileURLToPath } from 'node:url';

export default defineConfig([{
  entry: { 'paint-gpu': 'src/paint-gpu.js' },
  format: ['esm'],
  target: 'es2020',
  platform: 'browser',
  outDir: 'dist',
  minify: true,
  noExternal: ['three'],
  splitting: false,
  treeshake: true,
}, {
  entry: { 'sketchbook-entry': 'src/sketchbook-entry.tsx' },
  format: ['esm'],
  target: 'es2020',
  platform: 'browser',
  outDir: 'dist',
  minify: true,
  noExternal: ['react', 'react-dom'],
  loader: { '.css': 'text' },
  splitting: false,
  treeshake: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.alias = {
      '@designcodeio/threeui': fileURLToPath(new URL('./vendor/threeui-sketchbook/index.ts', import.meta.url)),
      '@designcodeio/threeui/style.css': fileURLToPath(new URL('./vendor/threeui-sketchbook/src/shaders/threeui.css', import.meta.url)),
    };
  },
}]);
