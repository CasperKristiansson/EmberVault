import { readable } from "svelte/store";

export type MatchMediaSource = () => MediaQueryList | null;

const defaultMatchMedia: MatchMediaSource = () => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return null;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)");
};

export const createReducedMotionStore = (
  source: MatchMediaSource = defaultMatchMedia
) => {
  return readable(false, (set) => {
    const media = source();
    if (!media) {
      return;
    }

    const update = () => set(media.matches);
    update();

    if (media.addEventListener) {
      media.addEventListener("change", update);
    } else if (media.addListener) {
      media.addListener(update);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", update);
      } else if (media.removeListener) {
        media.removeListener(update);
      }
    };
  });
};

export const prefersReducedMotion = createReducedMotionStore();
