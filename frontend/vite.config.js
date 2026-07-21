import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forwards /api/* to the backend during `npm run dev`, so the frontend
      // never needs to know the backend's URL directly.
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    }
  }
});
