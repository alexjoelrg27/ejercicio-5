// @ts-check
import { defineConfig, devices } from "@playwright/test";

const PUERTO = 4173;

/**
 * Sirve el sitio estatico en memoria para las pruebas.
 * Evita depender de herramientas externas en CI.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node scripts/serve.mjs ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
});