import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const publicUrl = (env.VITE_PUBLIC_URL || env.PUBLIC_URL || "").replace(/\/$/, "");
  const managementUrl = (env.VITE_MANAGEMENT_ORIGIN || env.MANAGEMENT_ORIGIN || "").replace(/\/$/, "");
  return {
    plugins: [react()],
    envDir: import.meta.dirname,
    define: {
      "import.meta.env.VITE_PUBLIC_URL": JSON.stringify(publicUrl),
      "import.meta.env.VITE_MANAGEMENT_ORIGIN": JSON.stringify(managementUrl),
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
