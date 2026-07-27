import { defineConfig } from "nitro";

export default defineConfig({
  preset: "cloudflare_module",
  renderer: false,
  compatibilityDate: "2025-09-15",
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
  },
});
