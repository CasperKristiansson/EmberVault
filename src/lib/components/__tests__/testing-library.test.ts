import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

describe("testing-library setup", () => {
  it("exposes render", () => {
    expect(typeof render).toBe("function");
  });
});
