import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Yönetim arayüzü: /api istekleri backend'e proxy edilir (gömülü terminal SSE dahil)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3999",
        changeOrigin: true
      }
    }
  }
});
