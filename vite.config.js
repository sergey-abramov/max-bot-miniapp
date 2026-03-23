import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths are the most robust option for GitHub Pages
  // and embedded WebView launches.
  base: "./",
});
