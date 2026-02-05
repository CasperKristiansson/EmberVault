import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

export type MotionPreset = "modal" | "list" | "collapse" | "fade";

export type MotionParameters = {
  preset: MotionPreset;
  reducedMotion?: boolean;
  enabled?: boolean;
  axis?: "x" | "y";
  offset?: number;
};

type MotionTiming = {
  duration: number;
};

export const resolveMotionTiming = (
  preset: MotionPreset,
  reducedMotion: boolean
): MotionTiming => {
  if (reducedMotion) {
    return { duration: 80 };
  }

  if (preset === "collapse") {
    return { duration: 160 };
  }

  return { duration: 120 };
};

const resolveSize = (node: Element, axis: "x" | "y"): number => {
  if (!(node instanceof HTMLElement)) {
    return 0;
  }
  return axis === "x" ? node.scrollWidth : node.scrollHeight;
};

const createDisabledTransition = (): TransitionConfig => ({
  duration: 0,
  css: () => "",
});

const createFadeTransition = (duration: number): TransitionConfig => ({
  duration,
  easing: cubicOut,
  css(progress) {
    return `opacity: ${progress};`;
  },
});

const createListTransition = (
  duration: number,
  offset: number
): TransitionConfig => ({
  duration,
  easing: cubicOut,
  css(progress) {
    return `opacity: ${progress}; transform: translateY(${(1 - progress) * offset}px);`;
  },
});

const createModalTransition = (duration: number): TransitionConfig => {
  const scaleStart = 0.98;
  return {
    duration,
    easing: cubicOut,
    css(progress) {
      const scale = scaleStart + (1 - scaleStart) * progress;
      return `opacity: ${progress}; transform: scale(${scale});`;
    },
  };
};

const createCollapseTransition = (
  node: Element,
  axis: "x" | "y",
  duration: number
): TransitionConfig => {
  const size = resolveSize(node, axis);
  const dimension = axis === "x" ? "width" : "height";
  return {
    duration,
    easing: cubicOut,
    css(progress) {
      return `overflow: hidden; ${dimension}: ${size * progress}px;`;
    },
  };
};

export const motion = (
  node: Element,
  parameters?: MotionParameters
): TransitionConfig => {
  const preset = parameters?.preset ?? "fade";
  const reducedMotion = parameters?.reducedMotion ?? false;
  const enabled = parameters?.enabled ?? true;
  const axis = parameters?.axis ?? "y";
  const offset = parameters?.offset ?? 4;
  const timing = resolveMotionTiming(preset, reducedMotion);

  if (!enabled || timing.duration === 0) {
    return createDisabledTransition();
  }

  if (reducedMotion) {
    return createFadeTransition(timing.duration);
  }

  const transitionFactories: Record<MotionPreset, () => TransitionConfig> = {
    collapse: () => createCollapseTransition(node, axis, timing.duration),
    modal: () => createModalTransition(timing.duration),
    list: () => createListTransition(timing.duration, offset),
    fade: () => createFadeTransition(timing.duration),
  };

  return transitionFactories[preset]();
};
