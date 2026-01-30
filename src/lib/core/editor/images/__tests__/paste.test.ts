import { describe, expect, it } from "vitest";
import { extractImageFromDataTransfer } from "../paste";

const createImageFile = (): File =>
  new File([new Uint8Array([1, 2, 3])], "image.png", {
    type: "image/png",
  });

const createTextFile = (): File =>
  new File(["notes"], "notes.txt", { type: "text/plain" });

describe("extractImageFromDataTransfer", () => {
  it("returns the image file from dataTransfer items", () => {
    const file = createImageFile();
    const dataTransfer = {
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => file,
        },
      ],
    };

    expect(extractImageFromDataTransfer(dataTransfer)).toBe(file);
  });

  it("falls back to dataTransfer files when items are missing", () => {
    const file = createImageFile();
    const dataTransfer = {
      files: [file],
    };

    expect(extractImageFromDataTransfer(dataTransfer)).toBe(file);
  });

  it("falls back to files when items do not include an image", () => {
    const file = createImageFile();
    const dataTransfer = {
      items: [
        {
          kind: "file",
          type: "text/plain",
          getAsFile: () => createTextFile(),
        },
      ],
      files: [file],
    };

    expect(extractImageFromDataTransfer(dataTransfer)).toBe(file);
  });

  it("returns null when no image is present", () => {
    const dataTransfer = {
      files: [createTextFile()],
    };

    expect(extractImageFromDataTransfer(dataTransfer)).toBeNull();
  });
});
