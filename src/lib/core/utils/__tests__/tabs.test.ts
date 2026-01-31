import { describe, expect, it } from "vitest";
import { addTab, closeTabState, reorderTabs } from "../tabs";

describe("tab helpers", () => {
  it("adds a tab if missing", () => {
    expect(addTab(["a"], "b")).toEqual(["a", "b"]);
  });

  it("does not duplicate existing tabs", () => {
    const tabs = ["a", "b"];
    expect(addTab(tabs, "a")).toBe(tabs);
  });

  it("closes inactive tabs without changing the active tab", () => {
    const state = { tabs: ["a", "b", "c"], activeTabId: "b" };
    expect(closeTabState(state, "a")).toEqual({
      tabs: ["b", "c"],
      activeTabId: "b",
    });
  });

  it("moves active tab to the next available tab on close", () => {
    const state = { tabs: ["a", "b", "c"], activeTabId: "b" };
    expect(closeTabState(state, "b")).toEqual({
      tabs: ["a", "c"],
      activeTabId: "c",
    });
  });

  it("falls back to previous tab when closing the last tab", () => {
    const state = { tabs: ["a", "b"], activeTabId: "b" };
    expect(closeTabState(state, "b")).toEqual({
      tabs: ["a"],
      activeTabId: "a",
    });
  });

  it("reorders tabs by moving the dragged tab before the target", () => {
    expect(reorderTabs(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(reorderTabs(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
  });
});
