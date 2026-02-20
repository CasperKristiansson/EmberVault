import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readS3Draft, writeS3Draft } from "../draft";

const originalLocalStorage = globalThis.localStorage;

describe("s3 draft persistence", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    const mockLocalStorage: Storage = {
      get length(): number {
        return data.size;
      },
      clear(): void {
        data.clear();
      },
      getItem(key: string): string | null {
        return data.get(key) ?? null;
      },
      key(index: number): string | null {
        return [...data.keys()][index] ?? null;
      },
      removeItem(key: string): void {
        data.delete(key);
      },
      setItem(key: string, value: string): void {
        data.set(key, value);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: mockLocalStorage,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("returns null when no draft is stored", () => {
    expect(readS3Draft()).toBeNull();
  });

  it("writes and reads draft fields from localStorage", () => {
    writeS3Draft({
      bucket: "s3://embervault",
      region: "eu-north-1",
      prefix: "embervault/",
      accessKeyId: "AKIA_TEST",
      secretAccessKey: "SECRET_TEST",
      sessionToken: "TOKEN",
    });

    expect(readS3Draft()).toEqual({
      bucket: "s3://embervault",
      region: "eu-north-1",
      prefix: "embervault/",
      accessKeyId: "AKIA_TEST",
      secretAccessKey: "SECRET_TEST",
      sessionToken: "TOKEN",
    });
  });

  it("ignores malformed stored payloads", () => {
    globalThis.localStorage.setItem("embervault:s3-draft", '{"bucket":"only"}');
    expect(readS3Draft()).toBeNull();
  });
});
