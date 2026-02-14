import type { AccentColor } from "$lib/core/storage/types";

export const resolveAccentColor = (value?: unknown): AccentColor => {
  if (
    value === "orange" ||
    value === "sky" ||
    value === "mint" ||
    value === "rose"
  ) {
    return value;
  }
  return "orange";
};
