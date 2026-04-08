// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['obrix_V2.png', 'favicon.ico'],
 
      manifest: {
        name:             'OBRIX ERP — GoldenRing',
        short_name:       'OBRIX',
        description:      'ERP de construcción con modo offline para obra',
        theme_color:      '#1E40AF',
        background_color: '#ffffff',
        display:          'standalone',
        orientation:      'portrait-primary',
        start_url:        '/',
        scope:            '/',
        lang:             'es-MX',
        icons: [
          {
            src:     '/obrix_V2.png',
            sizes:   '192x192',
            type:    'image/png',
            purpose: 'any maskable',
          },
          {
            src:     '/obrix_V2.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Avances de Obra',
            url: '/obra/avances',
            icons: [{ src: '/obrix_V2.png', sizes: '96x96' }],
          },
          {
            name: 'Solicitar Material',
            url: '/materials/requests',
            icons: [{ src: '/obrix_V2.png', sizes: '96x96' }],
          },
          {
            name: 'Tomar Asistencia',
            url: '/attendance',
            icons: [{ src: '/obrix_V2.png', sizes: '96x96' }],
          },
          {
            name: 'Registrar Gasto',
            url: '/gastos/mis-gastos',
            icons: [{ src: '/obrix_V2.png', sizes: '96x96' }],
          },
        ],
        categories: ['business', 'productivity'],
        prefer_related_applications: false,
      },
 
      workbox: {
        // ✅ CRÍTICO: aumentar límite para bundles >2MB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        
        // ✅ CORREGIDO: usar glob strings en lugar de regex (compatibilidad con workbox v7+)
        exclude: ['**/*.map', '**/workbox-*.js', '**/pdf.worker.*'],
 
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|woff2|woff)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'obrix-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /supabase\.co\/storage/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'obrix-storage',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /supabase\.co\/rest/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'obrix-api',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
        ],
      },
 
      // ✅ CORREGIDO: desactivar en producción para evitar conflictos en el build
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
 
  // ✅ Optimización de chunks para reducir bundle inicial
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React y sus dependencias
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // PDF pesado: separar en chunk propio
          'pdf-lib': ['pdfjs-dist'],
          // Utilidades pesadas
          'vendor-utils': ['html2canvas', 'jszip', 'purify-css'],
          // GoldenRing: separar lógica de sincronización
          'goldenring-core': [
            '@/services/goldenring.db',
            '@/services/goldenring.sync',
            '@/hooks/useOffline'
          ],
        },
      },
    },
    // ✅ Aumentar límite de advertencia de chunk (opcional, para logs más limpios)
    chunkSizeWarningLimit: 1000,
  },
 
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})