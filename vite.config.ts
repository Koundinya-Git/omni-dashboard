import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Put tailwindcss() FIRST
  plugins: [tailwindcss(), react()],
  clearScreen: false,
  server: {
    watch: {
      ignored: ["**/src-tauri/**"], // Tells Vite to ignore the Rust backend
    },
    port: 1420,
    strictPort: true,
  }
});