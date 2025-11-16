import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // load .env variables
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: '/AIsyrfBolt/', 
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'), // alias ke folder src/
      },
    },
    define: {
      // Jangan pakai process.env — gunakan import.meta.env
      // Tapi jika kamu memang butuh substitusi manual (misalnya lib non-Vite):
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    },
    build: {
      outDir: 'dist', // default, tapi eksplisitkan
      sourcemap: false,
    },
  };
});
