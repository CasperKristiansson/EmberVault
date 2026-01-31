import { describe, expect, it } from "vitest";
import {
  addTab,
  closeTabState,
  moveTabBetweenPanes,
  reorderTabs,
} from "../tabs";

describe("tab helpers", () => {
  it("adds a tab if missing", () => {
    expect(addTab(["a"], "b")).toEqual(["a", "b"]);
  });

  it("does not duplicate existing tabs", () => {
    const tabs = ["a", "b"];
    expect(addTab(tabs, "a")).toBe(tabs);
  });

  it("moves a tab between panes and activates it in the target", () => {
    const source = { tabs: ["a", "b"], activeTabId: "b" };
    const target = { tabs: ["c"], activeTabId: "c" };

    const result = moveTabBetweenPanes(source, target, "b");

    expect(result.source).toEqual({ tabs: ["a"], activeTabId: "a" });
    expect(result.target).toEqual({ tabs: ["c", "b"], activeTabId: "b" });
  });

  it("activates an existing tab in the target when moving", () => {
    const source = { tabs: ["a", "b"], activeTabId: "a" };
    const target = { tabs: ["b", "c"], activeTabId: "c" };

    const result = moveTabBetweenPanes(source, target, "b");

    expect(result.source).toEqual({ tabs: ["a"], activeTabId: "a" });
    expect(result.target).toEqual({ tabs: ["b", "c"], activeTabId: "b" });
  });

  it("returns the original state when the tab is missing from source", () => {
    const source = { tabs: ["a"], activeTabId: "a" };
    const target = { tabs: ["b"], activeTabId: "b" };

    const result = moveTabBetweenPanes(source, target, "c");

    expect(result.source).toBe(source);
    expect(result.target).toBe(target);
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
