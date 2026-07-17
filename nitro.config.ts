import { defineConfig } from "nitro";

export default defineConfig({
  preset: "cloudflare_module",
  renderer: false,
  compatibilityDate: "2024-09-19",
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
  },
});
