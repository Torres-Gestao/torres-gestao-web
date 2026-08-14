import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

// Deploy alvo: Cloudflare Pages (domínio próprio por lojista) -> base "/".
// VITE_BASE_PATH permite sobrescrever (ex.: subpasta no GitHub Pages).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE_PATH ?? "/",
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths(),
      VitePWA({
        // O registro é feito só pelo wrapper em src/lib/pwa-register.ts.
        injectRegister: null,
        registerType: "autoUpdate",
        filename: "sw.js",
        devOptions: { enabled: false },
        // O manifest é dinâmico por loja (public/manifest.webmanifest é o fallback).
        manifest: false,
        includeAssets: ["favicon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          // O bundle principal passa de 2 MiB (mapbox-gl); precisa entrar no precache.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/~oauth/],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Navegações NUNCA cache-first.
              urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-nav",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ url, request }: { url: URL; request: Request }) =>
                url.origin === self.location.origin &&
                // manifest/ícone da loja são dinâmicos (Pages Functions):
                // nunca cache-first, senão a logo trocada nunca aparece.
                !url.pathname.startsWith("/icon/") &&
                !url.pathname.startsWith("/manifest/") &&
                (request.destination === "script" ||
                  request.destination === "style" ||
                  request.destination === "font" ||
                  request.destination === "image"),
              handler: "CacheFirst",
              options: {
                cacheName: "assets-estaticos",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
    },
    preview: {
      host: "::",
      port: 8080,
      strictPort: true,
    },
  };
});
