import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    alias: {
      "@motionone/svelte": "src/lib/motion/transition",
    },
    adapter: adapter({
      fallback: "200.html",
    }),
  },
};

export default config;
