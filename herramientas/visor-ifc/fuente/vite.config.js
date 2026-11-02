import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // rutas relativas: el build funciona en GitHub Pages o en cualquier carpeta
  optimizeDeps: { exclude: ["web-ifc"] },
  build: { target: "es2022", chunkSizeWarningLimit: 6000 },
});
