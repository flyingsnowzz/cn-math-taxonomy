import { fileURLToPath, URL } from 'node:url'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

const webRoot = fileURLToPath(new URL('.', import.meta.url))
const generatedDataDir = path.join(webRoot, '.generated', 'data')

function generatedDataMiddleware(): Plugin {
  return {
    name: 'generated-data-middleware',
    configureServer(server) {
      server.middlewares.use('/data/', async (req, res, next) => {
        const requestPath = (req.url ?? '').split('?')[0]?.replace(/^\//, '') ?? ''
        const fileName = decodeURIComponent(requestPath)
        const target = path.resolve(generatedDataDir, fileName)
        if (!target.startsWith(`${generatedDataDir}${path.sep}`)) {
          next()
          return
        }

        try {
          const payload = await readFile(target)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(payload)
        } catch {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [vue(), tailwindcss(), generatedDataMiddleware()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('cytoscape') || id.includes('dagre')) return 'graph-vendor'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
})
