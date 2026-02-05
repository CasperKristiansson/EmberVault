import { readable } from "svelte/store";

export type MatchMediaSource = () => MediaQueryList | null;

const defaultMatchMedia: MatchMediaSource = () => {
  const { matchMedia } = globalThis;
  if (typeof matchMedia !== "function") {
    return null;
  }
  return matchMedia("(prefers-reduced-motion: reduce)");
};

export const createReducedMotionStore = (
  source: MatchMediaSource = defaultMatchMedia
) => {
  const handleReducedMotion = function handleReducedMotion(
    set: (value: boolean) => void
  ) {
    const media = source();
    if (!media) {
      return () => {
        source();
      };
    }

    const update = () => set(media.matches);
    update();

    media.addEventListener("change", update);

    return () => {
      media.removeEventListener("change", update);
    };
  };

  return readable(false, handleReducedMotion);
};

export const prefersReducedMotion = createReducedMotionStore();
