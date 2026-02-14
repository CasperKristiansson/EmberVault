import { describe, expect, it } from "vitest";

import { resolveAccentColor } from "$lib/core/utils/accent-color";

describe("resolveAccentColor", () => {
  it("defaults to orange", () => {
    expect(resolveAccentColor()).toBe("orange");
    expect(resolveAccentColor(null)).toBe("orange");
    expect(resolveAccentColor("")).toBe("orange");
    expect(resolveAccentColor("blue")).toBe("orange");
  });

  it("accepts known accent colors", () => {
    expect(resolveAccentColor("sky")).toBe("sky");
    expect(resolveAccentColor("mint")).toBe("mint");
    expect(resolveAccentColor("rose")).toBe("rose");
    expect(resolveAccentColor("orange")).toBe("orange");
  });
});
