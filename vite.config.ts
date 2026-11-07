import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // File watcher berbasis polling — mencegah HMR menyajikan module basi
    // di Windows (terutama path dengan spasi).
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  // Catatan: vendor splitting (advancedChunks/manualChunks) sudah dicoba dan
  // JUSTRU membengkakkan output di rolldown-vite (tree-shaking antd rusak) —
  // jangan ditambahkan lagi tanpa pengukuran.
})
