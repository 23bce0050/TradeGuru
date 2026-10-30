import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev mein frontend "/api" ko seedha backend (port 5000) par bhej deta hai.
// Isse CORS ka jhanjhat khatam, aur browser ko sirf localhost:5173 dikhta hai.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:5000", changeOrigin: true },
    },
  },
});
