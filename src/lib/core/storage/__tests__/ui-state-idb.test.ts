import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteIndexedDatabase, IndexedDBAdapter } from "../indexeddb.adapter";
import type { UIState } from "../types";

const uiState: UIState = {
  lastProjectId: "project-1",
  sidebarWidth: 260,
};

describe("IndexedDBAdapter UI state persistence", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    await deleteIndexedDatabase();
  });

  it("returns null when no UI state exists", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const stored = await adapter.readUIState();
    expect(stored).toBeNull();
  });

  it("writes and reads UI state", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    await adapter.writeUIState(uiState);

    const stored = await adapter.readUIState();
    expect(stored).toEqual(uiState);
  });
});
