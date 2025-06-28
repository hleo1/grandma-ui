import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['sharp', 'moondream']
      }
    },
    define: {
      'process.env.OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY),
      'process.env.GET_RESOURCES_URL': JSON.stringify(process.env.GET_RESOURCES_URL)
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
