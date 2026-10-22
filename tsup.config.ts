import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'paint-gpu': 'src/paint-gpu.js' },
  format: ['esm'],
  target: 'es2020',
  platform: 'browser',
  outDir: 'dist',
  minify: true,
  noExternal: ['three'],
  splitting: false,
  treeshake: true,
});
