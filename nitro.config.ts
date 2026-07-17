import { defineConfig } from "nitro";

export default defineConfig({
  preset: "cloudflare_module",
  compatibilityDate: "2024-09-19",
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
  },
});
