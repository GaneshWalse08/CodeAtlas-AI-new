import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on your LAN IP too, not just localhost - needed for shared links to reach other devices on the same network
  },
});
