import { describe, expect, it } from "vitest";
import { normalizeS3BucketName, normalizeS3ConfigInput } from "../config";

describe("normalizeS3BucketName", () => {
  it("removes s3:// prefix and path segments", () => {
    expect(normalizeS3BucketName("s3://embervault/notes")).toBe("embervault");
  });

  it("trims whitespace around bucket input", () => {
    expect(normalizeS3BucketName("  embervault  ")).toBe("embervault");
  });
});

describe("normalizeS3ConfigInput", () => {
  it("normalizes all s3 config fields", () => {
    expect(
      normalizeS3ConfigInput({
        bucket: " s3://embervault/path ",
        region: " eu-north-1 ",
        prefix: " embervault/ ",
        accessKeyId: " AKIA_TEST ",
        secretAccessKey: " SECRET_TEST ",
        sessionToken: " TOKEN ",
      })
    ).toEqual({
      bucket: "embervault",
      region: "eu-north-1",
      prefix: "embervault/",
      accessKeyId: "AKIA_TEST",
      secretAccessKey: "SECRET_TEST",
      sessionToken: "TOKEN",
    });
  });
});
