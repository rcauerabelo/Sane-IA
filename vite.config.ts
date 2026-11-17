import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function disableHmrClientPlugin(): Plugin {
  let hmrDisabled = false;
  return {
    name: 'saneia-disable-hmr-client',
    apply: 'serve',
    enforce: 'post',
    configResolved(config) {
      hmrDisabled = config.server.hmr === false || config.server.ws === false;
    },
    transform(code, id) {
      if (!hmrDisabled) return;
      const cleanId = id.split('?')[0].replace(/\\/g, '/');
      if (!cleanId.endsWith('vite/dist/client/client.mjs')) {
        return;
      }
      const startMarker = 'const transport = normalizeModuleRunnerTransport((() => {';
      const endMarker = '})());';
      const startIdx = code.indexOf(startMarker);
      if (startIdx === -1) {
        return;
      }
      const endIdx = code.indexOf(endMarker, startIdx);
      if (endIdx === -1) {
        return;
      }
      const noopTransport =
        'const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });';
      return {
        code:
          code.slice(0, startIdx) +
          noopTransport +
          code.slice(endIdx + endMarker.length),
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [
    disableHmrClientPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        id: '/',
        name: 'SaneIA — Chamados de Saneamento',
        short_name: 'SaneIA',
        description:
          'Aplicativo comunitário para abertura de chamados sobre falta de água e saneamento com análise por IA.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    hmr: false,
    ws: false,
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
});
