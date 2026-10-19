import { defineConfig, loadEnv } from "vite";
import { openRouterPlugin } from "./server/openrouter.mjs";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    watch: { ignored: ["**/qa/**"] },
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [
    react(),
    openRouterPlugin({ ...loadEnv(mode, process.cwd(), ""), ...process.env }),
  ],
}));
