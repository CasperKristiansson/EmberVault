import { describe, expect, it } from "vitest";
import { hashBlobSha256 } from "../hash";

describe("hash utils", () => {
  it("hashes a blob with sha-256", async () => {
    const blob = new Blob(["hello"]);
    const blobWithArrayBuffer = blob as Blob & {
      arrayBuffer?: () => Promise<ArrayBuffer>;
    };
    if (typeof blobWithArrayBuffer.arrayBuffer !== "function") {
      blobWithArrayBuffer.arrayBuffer = async () => {
        const { buffer } = new TextEncoder().encode("hello");
        await Promise.resolve();
        return buffer;
      };
    }
    const digest = await hashBlobSha256(blobWithArrayBuffer);

    expect(digest).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });
});
