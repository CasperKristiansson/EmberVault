import { afterEach, describe, expect, it, vi } from "vitest";
import { createDebouncedTask } from "../debounce";

describe("createDebouncedTask", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the latest task after the delay", () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 200);

    debounced.schedule("first");
    debounced.schedule("second");

    vi.advanceTimersByTime(199);
    expect(task).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenCalledWith("second");
  });

  it("flushes immediately and clears pending", async () => {
    const task = vi.fn();
    const debounced = createDebouncedTask(task, 200);

    debounced.schedule("now");
    await debounced.flush();

    expect(task).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenCalledWith("now");
    expect(debounced.pending()).toBe(false);
  });
});
