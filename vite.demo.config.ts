import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds one self-contained demo.html that opens by double-click (no server needed).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist-demo', emptyOutDir: true, target: 'es2022' },
});
