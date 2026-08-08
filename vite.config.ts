import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Deploy alvo: Cloudflare Pages (domínio próprio por lojista) -> base "/".
// VITE_BASE_PATH permite sobrescrever (ex.: subpasta no GitHub Pages).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE_PATH ?? "/",
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
