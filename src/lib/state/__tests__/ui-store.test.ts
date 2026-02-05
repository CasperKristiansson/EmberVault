import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import {
  clearToasts,
  dismissToast,
  pushToast,
  toastStore,
} from "$lib/state/ui.store";

afterEach(() => {
  clearToasts();
  vi.useRealTimers();
});

describe("ui.store toasts", () => {
  it("limits toast queue to two items", () => {
    pushToast("First", { durationMs: 0 });
    pushToast("Second", { durationMs: 0 });
    pushToast("Third", { durationMs: 0 });

    const queue = get(toastStore);
    expect(queue).toHaveLength(2);
    expect(queue[0]?.message).toBe("Second");
    expect(queue[1]?.message).toBe("Third");
  });

  it("dismisses toasts manually", () => {
    const id = pushToast("Dismiss me", { durationMs: 0 });
    expect(get(toastStore)).toHaveLength(1);
    dismissToast(id);
    expect(get(toastStore)).toHaveLength(0);
  });

  it("auto dismisses after duration", () => {
    vi.useFakeTimers();
    pushToast("Auto", { durationMs: 100 });
    expect(get(toastStore)).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(get(toastStore)).toHaveLength(0);
  });
});
