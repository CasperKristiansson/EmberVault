import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

export type MotionPreset = "modal" | "list" | "collapse" | "fade";

export type MotionParams = {
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

  switch (preset) {
    case "collapse":
      return { duration: 160 };
    case "modal":
    case "list":
    case "fade":
    default:
      return { duration: 120 };
  }
};

const resolveSize = (node: Element, axis: "x" | "y"): number => {
  if (!(node instanceof HTMLElement)) {
    return 0;
  }
  return axis === "x" ? node.scrollWidth : node.scrollHeight;
};

export const motion = (node: Element, params?: MotionParams): TransitionConfig => {
  const preset = params?.preset ?? "fade";
  const reducedMotion = params?.reducedMotion ?? false;
  const enabled = params?.enabled ?? true;
  const axis = params?.axis ?? "y";
  const offset = params?.offset ?? 4;
  const timing = resolveMotionTiming(preset, reducedMotion);

  if (!enabled || timing.duration === 0) {
    return {
      duration: 0,
      css: () => "",
    };
  }

  if (preset === "collapse" && !reducedMotion) {
    const size = resolveSize(node, axis);
    const dimension = axis === "x" ? "width" : "height";
    return {
      duration: timing.duration,
      easing: cubicOut,
      css: (t) => `overflow: hidden; ${dimension}: ${size * t}px;`,
    };
  }

  if (preset === "modal" && !reducedMotion) {
    const scaleStart = 0.98;
    return {
      duration: timing.duration,
      easing: cubicOut,
      css: (t) => {
        const scale = scaleStart + (1 - scaleStart) * t;
        return `opacity: ${t}; transform: scale(${scale});`;
      },
    };
  }

  if (preset === "list" && !reducedMotion) {
    return {
      duration: timing.duration,
      easing: cubicOut,
      css: (t) =>
        `opacity: ${t}; transform: translateY(${(1 - t) * offset}px);`,
    };
  }

  return {
    duration: timing.duration,
    easing: cubicOut,
    css: (t) => `opacity: ${t};`,
  };
};
