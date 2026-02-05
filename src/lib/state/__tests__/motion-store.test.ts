import { describe, expect, it } from "vitest";
import { createReducedMotionStore } from "$lib/state/motion.store";

class FakeMediaQueryList implements MediaQueryList {
  public readonly media: string;
  public matches: boolean;
  public onchange:
    | ((this: MediaQueryList, event: MediaQueryListEvent) => void)
    | null = null;
  private readonly listenerMap = new Map<
    | EventListenerOrEventListenerObject
    | ((this: MediaQueryList, event: MediaQueryListEvent) => void),
    (event: MediaQueryListEvent) => void
  >();
  private readonly captureListeners = new Set<
    (event: MediaQueryListEvent) => void
  >();
  private readonly bubbleListeners = new Set<
    (event: MediaQueryListEvent) => void
  >();

  public constructor(media: string, matches: boolean) {
    this.media = media;
    this.matches = matches;
  }

  public addEventListener(
    eventType: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (eventType !== "change") {
      return;
    }
    const resolved = this.resolveListener(listener);
    const shouldCapture =
      typeof options === "boolean" ? options : (options?.capture ?? false);
    const targetSet = shouldCapture
      ? this.captureListeners
      : this.bubbleListeners;
    targetSet.add(resolved);
  }

  public removeEventListener(
    eventType: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    if (eventType !== "change") {
      return;
    }
    const resolved = this.listenerMap.get(listener);
    if (!resolved) {
      return;
    }
    const shouldCapture =
      typeof options === "boolean" ? options : (options?.capture ?? false);
    const targetSet = shouldCapture
      ? this.captureListeners
      : this.bubbleListeners;
    targetSet.delete(resolved);
    this.listenerMap.delete(listener);
  }

  public addListener(
    listener: (this: MediaQueryList, event: MediaQueryListEvent) => void
  ): void {
    const resolved = this.resolveListener(listener);
    this.bubbleListeners.add(resolved);
  }

  public removeListener(
    listener: (this: MediaQueryList, event: MediaQueryListEvent) => void
  ): void {
    const resolved = this.listenerMap.get(listener);
    if (!resolved) {
      return;
    }
    this.bubbleListeners.delete(resolved);
    this.listenerMap.delete(listener);
  }

  public dispatchEvent(event: Event): boolean {
    if (event.type !== "change") {
      return false;
    }
    const mediaEvent = this.createEvent(this.matches);
    this.onchange?.(mediaEvent);
    this.emit(mediaEvent);
    return true;
  }

  public dispatch(matches: boolean): void {
    this.matches = matches;
    const mediaEvent = this.createEvent(matches);
    this.onchange?.(mediaEvent);
    this.emit(mediaEvent);
  }

  private emit(event: MediaQueryListEvent): void {
    for (const listener of this.captureListeners) {
      listener(event);
    }
    for (const listener of this.bubbleListeners) {
      listener(event);
    }
  }

  private resolveListener(
    listener:
      | EventListenerOrEventListenerObject
      | ((this: MediaQueryList, event: MediaQueryListEvent) => void)
  ): (event: MediaQueryListEvent) => void {
    const existing = this.listenerMap.get(listener);
    if (existing) {
      return existing;
    }
    const resolved =
      typeof listener === "function"
        ? (event: MediaQueryListEvent) => {
            listener.call(this, event);
          }
        : (event: MediaQueryListEvent) => {
            listener.handleEvent(event);
          };
    this.listenerMap.set(listener, resolved);
    return resolved;
  }

  private createEvent(matches: boolean): MediaQueryListEvent {
    return Object.assign(new Event("change"), {
      matches,
      media: this.media,
    });
  }
}

describe("prefersReducedMotion store", () => {
  it("emits initial match and reacts to changes", () => {
    const media = new FakeMediaQueryList(
      "(prefers-reduced-motion: reduce)",
      false
    );
    const store = createReducedMotionStore(() => media);
    const values: boolean[] = [];
    const handleValue = function handleValue(value: boolean): void {
      values.push(value);
    };
    const unsubscribe = store.subscribe(handleValue);

    expect(values.at(-1)).toBe(false);

    media.dispatch(true);
    expect(values.at(-1)).toBe(true);

    media.dispatch(false);
    expect(values.at(-1)).toBe(false);

    unsubscribe();
  });

  it("falls back to false when matchMedia is unavailable", () => {
    const store = createReducedMotionStore(() => null);
    const values: boolean[] = [];
    const handleValue = function handleValue(value: boolean): void {
      values.push(value);
    };
    const unsubscribe = store.subscribe(handleValue);

    expect(values).toEqual([false]);

    unsubscribe();
  });
});
