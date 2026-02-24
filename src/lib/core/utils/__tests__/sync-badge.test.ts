import { describe, expect, it } from "vitest";

import {
  resolveSyncBadgeDetail,
  resolveSyncBadgeLabel,
  resolveSyncBadgeText,
} from "$lib/core/utils/sync-badge";

describe("resolveSyncBadgeLabel", () => {
  it("maps sync states to labels", () => {
    expect(resolveSyncBadgeLabel("idle")).toBe("Idle");
    expect(resolveSyncBadgeLabel("syncing")).toBe("Syncing");
    expect(resolveSyncBadgeLabel("offline")).toBe("Offline");
    expect(resolveSyncBadgeLabel("error")).toBe("Needs attention");
  });
});

describe("resolveSyncBadgeDetail", () => {
  it("prioritizes pending item count", () => {
    expect(
      resolveSyncBadgeDetail({
        state: "syncing",
        pendingCount: 3,
        lastSuccessAt: 1_706_000_000_000,
      })
    ).toBe("3 pending");
  });

  it("falls back to last sync copy when there are no pending items", () => {
    expect(
      resolveSyncBadgeDetail(
        {
          state: "idle",
          pendingCount: 0,
          lastSuccessAt: 1_706_000_000_000,
        },
        () => "formatted"
      )
    ).toBe("Last sync: formatted");
  });
});

describe("resolveSyncBadgeText", () => {
  it("returns a single-line status summary", () => {
    expect(
      resolveSyncBadgeText(
        {
          state: "idle",
          pendingCount: 0,
          lastSuccessAt: null,
        },
        () => "Never"
      )
    ).toBe("Idle: Last sync: Never");
  });
});
