import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ["clawkpit.loca.lt"],
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    extensions: [".tsx", ".jsx", ".ts", ".mjs", ".js", ".cjs", ".json"],
  },
  css: { postcss: "./postcss.config.js" },
});
