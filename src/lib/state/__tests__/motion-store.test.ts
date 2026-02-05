import { describe, expect, it } from "vitest";
import { createReducedMotionStore } from "$lib/state/motion.store";

class FakeMediaQueryList implements MediaQueryList {
  public readonly media: string;
  public matches: boolean;
  public onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => void) | null =
    null;
  private readonly listeners = new Set<
    (this: MediaQueryList, ev: MediaQueryListEvent) => void
  >();

  public constructor(media: string, matches: boolean) {
    this.media = media;
    this.matches = matches;
  }

  public addEventListener(
    _type: "change",
    listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void,
    _options?: boolean | AddEventListenerOptions
  ): void {
    this.listeners.add(listener);
  }

  public removeEventListener(
    _type: "change",
    listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void,
    _options?: boolean | EventListenerOptions
  ): void {
    this.listeners.delete(listener);
  }

  public addListener(
    listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void
  ): void {
    this.listeners.add(listener);
  }

  public removeListener(
    listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void
  ): void {
    this.listeners.delete(listener);
  }

  public dispatchEvent(event: Event): boolean {
    const mediaEvent = event as MediaQueryListEvent;
    if (typeof mediaEvent.matches === \"boolean\") {
      this.matches = mediaEvent.matches;
    }
    this.onchange?.call(this, mediaEvent);
    for (const listener of this.listeners) {
      listener.call(this, mediaEvent);
    }
    return true;
  }

  public dispatch(matches: boolean): void {
    const event = { matches, media: this.media } as MediaQueryListEvent;
    this.dispatchEvent(event);
  }
}

describe("prefersReducedMotion store", () => {
  it("emits initial match and reacts to changes", () => {
    const media = new FakeMediaQueryList("(prefers-reduced-motion: reduce)", false);
    const store = createReducedMotionStore(() => media);
    const values: boolean[] = [];
    const unsubscribe = store.subscribe((value) => values.push(value));

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
    const unsubscribe = store.subscribe((value) => values.push(value));

    expect(values).toEqual([false]);

    unsubscribe();
  });
});
