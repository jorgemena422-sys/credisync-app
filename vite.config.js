import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  "/api": {
    target: "http://localhost:3001",
    changeOrigin: true
  }
};

export default defineConfig({
  cacheDir: ".vite-cache",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("@supabase/")) {
            return "supabase-vendor";
          }

          if (id.includes("react-dom") || id.includes("react")) {
            return "react-vendor";
          }

          return "vendor";
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: apiProxy
  },
  preview: {
    proxy: apiProxy
  }
});
