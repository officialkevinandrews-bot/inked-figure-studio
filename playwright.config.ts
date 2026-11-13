import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    launchOptions: {
      args: ["--enable-webgl", "--ignore-gpu-blocklist"],
    },
  },
});

