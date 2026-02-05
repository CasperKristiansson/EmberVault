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
    build: {
      rollupOptions: {
        output: {
          // Keep route chunks smaller by splitting heavy vendor groups explicitly.
          manualChunks: (id): string | undefined => {
            if (!id.includes("node_modules")) return undefined;

            if (id.includes("/katex/")) return "vendor-katex";
            if (id.includes("/lowlight/")) return "vendor-lowlight";
            if (id.includes("/prosemirror-")) return "vendor-prosemirror";
            if (id.includes("/@tiptap/")) return "vendor-tiptap";

            if (id.includes("/graphology/") || id.includes("/sigma/")) {
              return "vendor-graph";
            }

            if (id.includes("/minisearch/")) {
              return "vendor-search";
            }

            return "vendor";
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      include: ["src/**/*.{test,spec}.{js,ts}"],
      setupFiles: ["src/test/setup.ts"],
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
    },
  };
});
