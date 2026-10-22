import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

// Genera dist/sw.js con la lista de precache y una versión derivada del
// contenido. Precarga el shell de entrada y el modal (para que abrir un lugar
// funcione offline), pero NUNCA el chunk 3D (~2 MB): así el móvil no descarga
// three.js al instalar la PWA.
function serviceWorkerPlugin(): Plugin {
  let outDir = resolve(root, 'dist')

  return {
    name: 'geovista-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      const entryAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)]
        .map((match) => match[1])
        // Nunca precargar los chunks pesados o bajo demanda.
        .filter((asset) => !/(?:GlobeBackground|ExploreModal|AdminPanel|globe|motion)-/.test(asset))
        .filter((asset) => {
          try {
            return statSync(resolve(outDir, asset.slice(1))).size <= 1_200_000
          } catch {
            return false
          }
        })

      // Chunks ligeros que sí conviene tener offline: GlobeBackdrop pinta el
      // globo 2D en móvil (3 KB) y ExploreModal permite abrir un destino
      // (127 KB). Ninguno arrastra three.js.
      const lazyChunks = readdirSync(resolve(outDir, 'assets'))
        .filter((name) => /^(?:GlobeBackdrop|ExploreModal|AdminPanel)-.*\.js$/.test(name))
        .map((name) => `/assets/${name}`)

      // Un chunk lazy puede importar otro compartido (p. ej. useModalA11y).
      // Recorremos los imports relativos para que el precache no se quede a
      // medias y abrir el modal siga funcionando offline.
      const heavyAsset = (asset: string) => /(?:GlobeBackground|globe)-/.test(asset)
      const pending = [...new Set([...entryAssets, ...lazyChunks])]
      const precacheAssets = new Set<string>()
      while (pending.length > 0) {
        const asset = pending.pop()!
        if (precacheAssets.has(asset) || heavyAsset(asset)) continue
        precacheAssets.add(asset)
        if (!asset.endsWith('.js')) continue

        let code: string
        try {
          code = readFileSync(resolve(outDir, asset.slice(1)), 'utf8')
        } catch {
          continue
        }
        const assetDir = resolve(outDir, asset.slice(1), '..')
        for (const match of code.matchAll(
          /(?:from\s*|import\s*\(\s*)["'](\.\/[^"']+\.js)["']/g,
        )) {
          const dependency = relative(outDir, resolve(assetDir, match[1])).replace(/\\/g, '/')
          if (!dependency.startsWith('..')) pending.push(`/${dependency}`)
        }
      }

      const precache = [
        ...new Set([
          '/',
          '/index.html',
          '/manifest.webmanifest',
          '/favicon.svg',
          '/logo.svg',
          '/icons.svg',
          '/icon-192.png',
          '/icon-512.png',
          '/maskable-512.png',
          '/apple-touch-icon.png',
          '/earth-topology.png',
          ...precacheAssets,
        ]),
      ]

      const template = readFileSync(resolve(root, 'sw.template.js'), 'utf8')
      const hash = createHash('sha256').update(template)
      for (const url of precache) {
        const file = url === '/' ? 'index.html' : url.replace(/^\//, '')
        try {
          hash.update(readFileSync(resolve(outDir, file)))
        } catch {
          hash.update(url)
        }
      }
      const version = hash.digest('hex').slice(0, 10)

      const sw = template
        .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
        .replace(
          "const PRECACHE = ['/'];",
          `const PRECACHE = ${JSON.stringify(precache, null, 2)};`,
        )

      writeFileSync(resolve(outDir, 'sw.js'), sw)
      console.log(`[sw] v${version} · ${precache.length} recursos precargados`)
    },
  }
}

// Proxy /api -> backend ASP.NET Core en desarrollo.
export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5028',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    // Sin manualChunks: Rolldown agrupa three.js y framer-motion en los chunks
    // de sus imports dinámicos (globo y modal). Un manualChunks que compartía
    // React metía el globo en el grafo del entry y se descargaba también en móvil.
  },
})
