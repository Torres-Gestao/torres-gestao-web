import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// GitHub Pages base path.
// Repo: torres-gestao-web  ->  https://<user>.github.io/torres-gestao-web/
// Em desenvolvimento (Lovable preview) mantemos "/" para não quebrar o iframe.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProd = mode === "production";
  return {
    base: isProd ? (env.VITE_BASE_PATH ?? "/torres-gestao-web/") : "/",
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
    },
    preview: {
      host: "::",
      port: 8080,
      strictPort: true,
    },
  };
});
