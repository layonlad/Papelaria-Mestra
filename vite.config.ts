import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Configuração do Vite 6 com React 19 e Tailwind CSS v4.
// Em desenvolvimento o Vite roda em middlewareMode dentro do Express (ver server.ts),
// então aqui expomos apenas a config de build do cliente e os plugins.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
