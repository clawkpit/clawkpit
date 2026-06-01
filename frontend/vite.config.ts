import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: ["favicon.svg", "pwa/icon-192x192.png", "pwa/icon-512x512.png", "pwa/icon-512x512-maskable.png"],
      manifest: {
        name: "Clawkpit",
        short_name: "Clawkpit",
        description: "AI-managed Kanban board — local-first, privacy-friendly.",
        theme_color: "#fefaf7",
        background_color: "#fefaf7",
        display: "standalone",
        scope: "/",
        start_url: "/board",
        icons: [
          {
            src: "/pwa/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa/icon-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    allowedHosts: ["clawkpit.loca.lt", ".serveousercontent.com", ".serveo.net"],
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true, ws: true },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    extensions: [".tsx", ".jsx", ".ts", ".mjs", ".js", ".cjs", ".json"],
  },
  css: { postcss: "./postcss.config.js" },
});
