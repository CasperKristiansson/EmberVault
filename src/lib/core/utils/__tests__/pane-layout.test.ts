import { describe, expect, it } from "vitest";
import {
  collectLeafPaneIds,
  countLeaves,
  dockLeaf,
  removeLeaf,
} from "../pane-layout";

describe("pane-layout", () => {
  it("docks a new leaf to the right of a target", () => {
    const layout = { type: "leaf" as const, paneId: "a" };
    const next = dockLeaf({
      layout,
      targetPaneId: "a",
      side: "right",
      newPaneId: "b",
    });
    expect(countLeaves(next)).toBe(2);
    expect(collectLeafPaneIds(next)).toEqual(["a", "b"]);
    expect(next.type).toBe("split");
    if (next.type === "split") {
      expect(next.direction).toBe("row");
    }
  });

  it("docks a new leaf to the top of a target", () => {
    const layout = { type: "leaf" as const, paneId: "a" };
    const next = dockLeaf({
      layout,
      targetPaneId: "a",
      side: "top",
      newPaneId: "b",
    });
    expect(countLeaves(next)).toBe(2);
    expect(collectLeafPaneIds(next)).toEqual(["b", "a"]);
    expect(next.type).toBe("split");
    if (next.type === "split") {
      expect(next.direction).toBe("column");
    }
  });

  it("removes a leaf and collapses redundant splits", () => {
    const layout = dockLeaf({
      layout: dockLeaf({
        layout: { type: "leaf" as const, paneId: "a" },
        targetPaneId: "a",
        side: "right",
        newPaneId: "b",
      }),
      targetPaneId: "b",
      side: "right",
      newPaneId: "c",
    });
    expect(countLeaves(layout)).toBe(3);
    const removed = removeLeaf({ layout, paneId: "c" });
    expect(countLeaves(removed)).toBe(2);
    expect(collectLeafPaneIds(removed)).toEqual(["a", "b"]);
  });
});
