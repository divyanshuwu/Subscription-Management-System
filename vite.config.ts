import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const plugins = [react(), tailwindcss()];

  const env = loadEnv(mode, process.cwd(), ["VITE_", "NEXT_PUBLIC_"]);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    server: {
      host: "0.0.0.0",
      allowedHosts: [".e2b.app", "localhost"],
      proxy: {"/api": {target: process.env.API_PROXY_TARGET || "http://127.0.0.1:4000",changeOrigin:true}},
    },
    preview: {host:"0.0.0.0",allowedHosts:[".e2b.app","localhost"]},
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom"],
            motion: ["framer-motion"],
          },
        },
      },
    },
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: processEnvDefines,
  };
});
