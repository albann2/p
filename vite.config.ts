import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // Le cache hors-ligne des appels REST doit suivre le projet Supabase réellement
  // configuré : sinon, après un changement de projet, plus rien n'est mis en cache.
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseHost = (env.VITE_SUPABASE_URL ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const restCachePattern = supabaseHost
    ? new RegExp(`^https://${supabaseHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/rest/v1/candidates.*`, 'i')
    : /\/rest\/v1\/candidates.*/i

  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Prix — Candidats',
        short_name: 'Prix',
        description:
          'Consultation et gestion du statut des candidats, avec support hors connexion.',
        lang: 'fr',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: restCachePattern,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  server: { port: 5173 }
  }
})
