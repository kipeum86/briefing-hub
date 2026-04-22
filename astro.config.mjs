// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://kipeum86.github.io",
  base: "/briefing-hub",
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
});

