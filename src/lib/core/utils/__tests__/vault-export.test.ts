import { describe, expect, it } from "vitest";

import {
  buildExportNoteFileName,
  resolveFolderPathSegments,
  sanitizePathSegment,
} from "$lib/core/utils/vault-export";
import type { Vault } from "$lib/core/storage/types";

describe("vault export utils", () => {
  it("sanitizes path segments", () => {
    expect(sanitizePathSegment("  hello/world  ", "Untitled")).toBe(
      "hello_world"
    );
    expect(sanitizePathSegment("...", "Untitled")).toBe("Untitled");
    expect(sanitizePathSegment("", "Untitled")).toBe("Untitled");
  });

  it("builds readable, unique note filenames", () => {
    expect(
      buildExportNoteFileName({
        id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        title: "A/B",
      })
    ).toBe("A_B - 01ARZ3NDEKTSV4RRFFQ69G5FAV.md");
  });

  it("resolves folder path segments for nested folders", () => {
    const vault: Vault = {
      id: "vault",
      name: "Vault",
      createdAt: 0,
      updatedAt: 0,
      folders: {
        root: {
          id: "root",
          name: "Projects",
          parentId: null,
          childFolderIds: ["child"],
        },
        child: {
          id: "child",
          name: "Klimra",
          parentId: "root",
          childFolderIds: [],
        },
      },
      tags: {},
      notesIndex: {},
      templatesIndex: {},
      settings: {},
    };

    expect(resolveFolderPathSegments(vault, "child")).toEqual([
      "Projects",
      "Klimra",
    ]);
    expect(resolveFolderPathSegments(vault, null)).toEqual([]);
    expect(resolveFolderPathSegments(vault, "missing")).toEqual([]);
  });
});
