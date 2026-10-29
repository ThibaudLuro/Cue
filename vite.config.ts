import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages sert le site sous https://thibaudluro.github.io/Cue/
  base: command === 'build' ? '/Cue/' : '/',
  plugins: [react(), tailwindcss()],
}))
