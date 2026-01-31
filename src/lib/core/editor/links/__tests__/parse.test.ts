import { describe, expect, it } from "vitest";
import { extractWikiLinks, resolveOutgoingLinks } from "../parse";
import type { NoteIndexEntry } from "$lib/core/storage/types";

const createNote = (
  id: string,
  title: string,
  deletedAt: number | null = null
): NoteIndexEntry => ({
  id,
  title,
  deletedAt,
  folderId: null,
  tagIds: [],
  favorite: false,
  createdAt: 0,
  updatedAt: 0,
  isTemplate: false,
});

describe("extractWikiLinks", () => {
  it("returns empty when no links exist", () => {
    expect(extractWikiLinks("Plain text only")).toEqual([]);
  });

  it("extracts multiple wiki links", () => {
    const text = "See [[First Note]] and [[Second Note]] for details.";
    expect(extractWikiLinks(text)).toEqual(["First Note", "Second Note"]);
  });

  it("trims whitespace inside links", () => {
    const text = "Go to [[  Trim Me  ]] now.";
    expect(extractWikiLinks(text)).toEqual(["Trim Me"]);
  });
});

describe("resolveOutgoingLinks", () => {
  it("resolves direct id matches", () => {
    const notes = [createNote("01HAAA", "Alpha")];
    expect(resolveOutgoingLinks("Link [[01HAAA]]", notes)).toEqual(["01HAAA"]);
  });

  it("resolves unique exact title matches", () => {
    const notes = [createNote("01HAAA", "Alpha")];
    expect(resolveOutgoingLinks("Link [[Alpha]]", notes)).toEqual(["01HAAA"]);
  });

  it("keeps ambiguous title matches unresolved", () => {
    const notes = [
      createNote("01HAAA", "Shared"),
      createNote("01HBBB", "Shared"),
    ];
    expect(resolveOutgoingLinks("Link [[Shared]]", notes)).toEqual(["Shared"]);
  });

  it("keeps unknown titles unresolved", () => {
    const notes = [createNote("01HAAA", "Alpha")];
    expect(resolveOutgoingLinks("Link [[Missing]]", notes)).toEqual([
      "Missing",
    ]);
  });
});
