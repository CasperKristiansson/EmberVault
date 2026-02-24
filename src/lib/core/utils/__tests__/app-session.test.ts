import { describe, expect, it } from "vitest";
import {
  consumeSkipLandingAutoRedirect,
  hasStoredVaultSession,
  markSkipLandingAutoRedirectOnce,
} from "../app-session";

const createS3Settings = () =>
  ({
    storageMode: "s3",
    s3: {
      bucket: "bucket-name",
      region: "eu-north-1",
      accessKeyId: "ACCESS_KEY",
      secretAccessKey: "SECRET_KEY",
    },
  }) as const;

describe("app session helpers", () => {
  it("detects whether stored settings are usable for auto entry", () => {
    expect(hasStoredVaultSession(null)).toBe(false);
    expect(hasStoredVaultSession({ storageMode: "idb" })).toBe(true);
    expect(hasStoredVaultSession({ storageMode: "filesystem" })).toBe(false);
    expect(
      hasStoredVaultSession({
        storageMode: "filesystem",
        fsHandle: { name: "Vault" },
      })
    ).toBe(true);
    expect(hasStoredVaultSession({ storageMode: "s3" })).toBe(false);
    expect(hasStoredVaultSession(createS3Settings())).toBe(true);
  });

  it("marks and consumes one-time homepage redirect skip flag", () => {
    const storageMap = new Map<string, string>();
    const storage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storageMap.set(key, value);
      },
      removeItem: (key: string) => {
        storageMap.delete(key);
      },
    };

    expect(consumeSkipLandingAutoRedirect(storage)).toBe(false);
    markSkipLandingAutoRedirectOnce(storage);
    expect(consumeSkipLandingAutoRedirect(storage)).toBe(true);
    expect(consumeSkipLandingAutoRedirect(storage)).toBe(false);
  });

  it("handles storage read/write errors gracefully", () => {
    const failingStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(() => markSkipLandingAutoRedirectOnce(failingStorage)).not.toThrow();
    expect(consumeSkipLandingAutoRedirect(failingStorage)).toBe(false);
  });
});
