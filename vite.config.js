import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite + Vitest. Sem alias magico: caminho relativo mantem a origem do import obvia
// em review de codigo (patterns.md, estrutura por-feature).
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'supabase/**/*.test.js'],
    coverage: { reporter: ['text', 'html'], include: ['src/**'] },
  },
})
