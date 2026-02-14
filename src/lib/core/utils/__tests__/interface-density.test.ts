import { describe, expect, it } from "vitest";

import { resolveInterfaceDensity } from "$lib/core/utils/interface-density";

describe("resolveInterfaceDensity", () => {
  it("defaults to comfortable", () => {
    expect(resolveInterfaceDensity()).toBe("comfortable");
    expect(resolveInterfaceDensity(null)).toBe("comfortable");
    expect(resolveInterfaceDensity("")).toBe("comfortable");
    expect(resolveInterfaceDensity("COMPACT")).toBe("comfortable");
  });

  it("accepts compact", () => {
    expect(resolveInterfaceDensity("compact")).toBe("compact");
  });
});
