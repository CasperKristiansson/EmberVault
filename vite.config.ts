import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const isTest = mode === "test" || process.env.VITEST === "true";
  const testResolve = {
    conditions: ["module", "browser", "development|production"],
  };

  return {
    plugins: [sveltekit()],
    ...(isTest ? { resolve: testResolve, ssr: { resolve: testResolve } } : {}),
    test: {
      environment: "jsdom",
      include: ["src/**/*.{test,spec}.{js,ts}"],
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
    },
  };
});
